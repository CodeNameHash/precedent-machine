// ───────────────────────────────────────────────────────────────────────────
// table-logic.js — pure display-logic helpers for the review tables.
//
// DELIBERATELY JSX-FREE and dependency-free: `npm test` runs under
// `node --test` with no build step, so everything here is directly importable
// by tests in tests/*.test.js (via dynamic import, like lib/canonical-
// conditions.js). Components in pages/review/[id].js and components/review/*
// import these helpers and wire them into JSX.
//
// The owner-feedback round (Metsera fb2) flagged several REPEAT failures whose
// earlier "fixes" lived only inside JSX render paths no test could reach.
// Extracting the decisions here is what makes the regression tests possible.
// ───────────────────────────────────────────────────────────────────────────

// Value-shape discriminators, mirroring lib/citable.js (inlined so this module
// stays dependency-free — same pattern as lib/canonical-conditions.js).
const isCitable = (v) => v != null && typeof v === 'object' && !Array.isArray(v) && 'value' in v && !('code' in v);
const isTagged = (v) => v != null && typeof v === 'object' && !Array.isArray(v) && typeof v.code === 'string' && v.code.length > 0;
const unwrap = (v) => (isCitable(v) ? v.value : v);

// Collect every text/quote string attached to a (possibly citable/tagged)
// feature value, plus the unwrapped value itself when it's a string.
function collectTexts(raw) {
  const out = [];
  const push = (s) => { if (typeof s === 'string' && s.trim()) out.push(s.trim()); };
  if (raw === null || raw === undefined) return out;
  if (typeof raw === 'string') { push(raw); return out; }
  if (typeof raw === 'object') {
    push(raw.text);
    if (Array.isArray(raw.quotes)) raw.quotes.forEach(push);
    const inner = unwrap(raw);
    if (typeof inner === 'string') push(inner);
    else if (inner && typeof inner === 'object') push(inner.text);
  }
  return out;
}

/* ══════════════════════════════════════════════════════════════════════════
 * BLOCK 1 — Consideration hero: per-share cell parts.
 * The Per-Share Consideration cell renders "<cash pill> + <CVR pill>" with a
 * literal "+" separator, and NO trailing "per share" (the left-hand label
 * already says Per-Share). Returns [{ type: 'pill'|'plus', text }].
 * ══════════════════════════════════════════════════════════════════════════ */
export function buildPerShareParts({ perShareText, hasCvr, hasCash, cvrMaxText }) {
  const parts = [];
  if (perShareText) {
    parts.push({ type: 'pill', text: hasCvr && hasCash ? `${perShareText} in cash` : perShareText });
  }
  if (hasCvr) {
    if (parts.length > 0) parts.push({ type: 'plus', text: '+' });
    parts.push({ type: 'pill', text: `1 CVR${cvrMaxText ? ` (up to ${cvrMaxText})` : ''}` });
  }
  return parts;
}

/* ══════════════════════════════════════════════════════════════════════════
 * BLOCK 2a — Term-cell hover quote (REGRESSION target).
 * The Term (first, sticky) cell of every provision-table row hovers to the
 * row's provision source text — for EVERY row, not just rows whose qualifier
 * cell happens to carry evidence. The earlier fix (commit 686530d, audit
 * block 9a) routed only VALUE cells through CellWithSource /
 * MaterialityQualifierCell fallbacks; the Term cell never went through either
 * renderer, so it silently kept no hover at all.
 * ══════════════════════════════════════════════════════════════════════════ */
export function termCellHoverQuote(provision) {
  const t = provision && typeof provision.full_text === 'string' ? provision.full_text.trim() : '';
  return t ? provision.full_text : null;
}

/* ══════════════════════════════════════════════════════════════════════════
 * BLOCK 2c — Knowledge-qualifier cell display.
 * Returns null when the rep carries no knowledge qualifier; otherwise
 * { label, code, scope: 'partial'|'entire'|null, detail, quote }.
 * Scope is only reported when the feature itself indicates it (text naming
 * specific sub-clauses / sentences, or an explicit scope field) — never
 * invented. Most current extracts carry a bare boolean `true` with no scope
 * info, so scope stays null and callers render just the standard.
 * ══════════════════════════════════════════════════════════════════════════ */
const KQ_PARTIAL_RES = [
  /(?:solely|only)\s+(?:with\s+respect\s+to|as\s+to|in\s+respect\s+of|for)\s[^.]{0,120}/i,
  /clauses?\s*\([a-z0-9]+\)[^.]{0,80}/i,
  /(?:first|second|third|last)\s+sentence[^.]{0,80}/i,
  /certain\s+(?:portions|clauses|subsections|sentences)[^.]{0,80}/i,
];

export function knowledgeQualifierDisplay(raw) {
  if (raw === null || raw === undefined || raw === '' || raw === false) return null;
  const inner = unwrap(raw);
  if (inner === null || inner === undefined || inner === '' || inner === false) return null;

  const texts = collectTexts(raw);
  const quote = texts.length > 0 ? texts.join('\n\n') : null;

  let label = null;
  let code = null;
  if (isTagged(inner)) {
    label = inner.label || null;
    code = inner.code || null;
  } else if (typeof inner === 'string') {
    label = inner;
  } else if (inner === true) {
    label = 'Knowledge-qualified';
  }

  // Explicit scope fields win; otherwise scan attached text for sub-clause
  // scoping language. No signal → scope null (render just the standard).
  let scope = null;
  let detail = null;
  const scopeField = (raw && typeof raw === 'object' && (raw.scope || raw.appliesTo))
    || (inner && typeof inner === 'object' && (inner.scope || inner.appliesTo))
    || null;
  if (typeof scopeField === 'string') {
    const s = scopeField.toUpperCase();
    if (s === 'ENTIRE' || s === 'ENTIRE_REP' || s === 'WHOLE_REP') scope = 'entire';
    else if (s === 'PARTIAL') scope = 'partial';
  }
  if (!scope) {
    for (const t of texts) {
      for (const re of KQ_PARTIAL_RES) {
        const m = t.match(re);
        if (m) { scope = 'partial'; detail = m[0].replace(/\s+/g, ' ').trim(); break; }
      }
      if (scope) break;
    }
  }
  if (scope === 'partial' && !detail && typeof scopeField === 'string') detail = scopeField;

  return { label, code, scope, detail, quote };
}

/* ══════════════════════════════════════════════════════════════════════════
 * BLOCK 2d — ERISA / Employee Benefits rep: specific-features suppression.
 * ══════════════════════════════════════════════════════════════════════════ */
export function isErisaBenefitsRep(provision) {
  if (!provision) return false;
  const code = String(
    (provision.ai_metadata && provision.ai_metadata.code) || provision.code || '',
  ).toUpperCase();
  if (code === 'REP-T-BENEFITS' || code === 'REP-B-BENEFITS') return true;
  return /erisa|employee\s+benefit/i.test(String(provision.category || ''));
}

/* ══════════════════════════════════════════════════════════════════════════
 * BLOCK 2e / 4b — AGREEMENT ORDER: natural sort by features.sectionNumber.
 * "3.02" < "3.10" (numeric segments, not string compare), sub-clause parens
 * compared alphanumerically. Rows without a parseable section number keep
 * their existing relative order and sort after sectioned rows.
 * ══════════════════════════════════════════════════════════════════════════ */
export function parseSectionParts(s) {
  const str = String(s || '').trim();
  const m = str.match(/^(\d+(?:\.\d+)*)\s*((?:\([a-z0-9]+\))*)$/i);
  if (!m) return null;
  const nums = m[1].split('.').map(Number);
  const subs = [...m[2].matchAll(/\(([a-z0-9]+)\)/gi)].map((x) => x[1].toLowerCase());
  return { nums, subs };
}

export function compareSectionParts(a, b) {
  const n = Math.max(a.nums.length, b.nums.length);
  for (let i = 0; i < n; i++) {
    const av = a.nums[i], bv = b.nums[i];
    if (av === undefined) return -1;
    if (bv === undefined) return 1;
    if (av !== bv) return av - bv;
  }
  const sn = Math.max(a.subs.length, b.subs.length);
  for (let i = 0; i < sn; i++) {
    const av = a.subs[i], bv = b.subs[i];
    if (av === undefined) return -1;
    if (bv === undefined) return 1;
    if (av !== bv) return av < bv ? -1 : 1;
  }
  return 0;
}

/** Sort a list into agreement order by section number. `getSection` maps an
 *  item to its section string; items without a parseable section keep their
 *  current relative order, after the sectioned items. Stable. */
export function sortByAgreementOrder(items, getSection) {
  const decorated = (items || []).map((item, idx) => ({
    item,
    idx,
    sec: parseSectionParts(getSection(item)),
  }));
  decorated.sort((a, b) => {
    if (a.sec && b.sec) {
      const c = compareSectionParts(a.sec, b.sec);
      if (c !== 0) return c;
      return a.idx - b.idx;
    }
    if (a.sec) return -1;
    if (b.sec) return 1;
    return a.idx - b.idx;
  });
  return decorated.map((d) => d.item);
}

/* ══════════════════════════════════════════════════════════════════════════
 * BLOCK 2f — Disclosure-schedules General-Exception cell: extract just the
 * cross-qualification STANDARD sentence ("disclosure in any section shall be
 * deemed to qualify … to the extent that it is reasonably apparent on its
 * face …") from the stored verbatim reference. Full text stays in hover.
 * ══════════════════════════════════════════════════════════════════════════ */
export function extractCrossQualificationSentence(text) {
  const s = typeof text === 'string' ? text : '';
  if (!s) return null;
  const kw = s.search(/deemed\s+to\s+qualify|reasonably\s+apparent/i);
  if (kw < 0) return null;
  // Expand left to the previous clause boundary, right to the next one.
  const left = Math.max(
    s.lastIndexOf('(', kw),
    s.lastIndexOf('.', kw),
    s.lastIndexOf(';', kw),
    s.lastIndexOf(',', kw),
  );
  const start = left >= 0 ? left + 1 : 0;
  let end = s.length;
  for (const ch of ['.', ';', ')']) {
    const i = s.indexOf(ch, kw);
    if (i >= 0 && i < end) end = i;
  }
  const out = s.slice(start, end).replace(/\s+/g, ' ').trim().replace(/^and\s+/i, '');
  return out || null;
}

/* ══════════════════════════════════════════════════════════════════════════
 * BLOCK 3e — Reps bring-down tiers (REGRESSION target).
 * The earlier per-group renderer (commit 4358e43) over-collapsed: the
 * catch-all detector relabelled a tier whose group text read "All Company
 * representations and warranties OTHER THAN Section 3.01 (first sentence
 * only), …" as just "All other reps" (dropping the exclusions), resolved
 * cites to a truncated "name, name, name +N" preview (dropping "(first
 * sentence only)" qualifiers), de-duplicated lines, and re-sorted tiers.
 * A rep can legitimately appear under TWO tiers (excluded from the MAE tier
 * AND listed in the material-respects tier) — the renderer must show both.
 *
 * buildBringdownTierLines renders ONE LINE PER TIER, faithfully, in extracted
 * order: '<group description> → <standard headline>'. Section cites resolve
 * to rep names (via nameBySec) with parenthetical qualifiers preserved;
 * unresolvable cites stay verbatim.
 * ══════════════════════════════════════════════════════════════════════════ */
export function bringdownStandardHeadline(tier) {
  const raw = String(tier.standard_label || tier.standardLabel || tier.standard || tier.standardCode || '').toLowerCase();
  if (/de\s*minimis/.test(raw)) return 'De minimis';
  if (/all\s+material\s+respects|material\s+respects/.test(raw)) return 'In all material respects';
  if (/mae|material\s+adverse/.test(raw)) return 'MAE standard';
  if (/all\s+respects/.test(raw)) return 'In all respects';
  const s = String(tier.standard_label || tier.standardLabel || tier.standard || tier.standardCode || '(unspecified)');
  return s.length > 60 ? `${s.slice(0, 59)}…` : s;
}

/** Replace "Section X.YZ(a)(i)" cites in a reps_covered description with the
 *  resolved rep names, keeping sub-clause parens attached and leaving every
 *  free-text qualifier ("(first sentence only)", "other than", "through")
 *  untouched. nameBySec maps section strings ("3.02", "3.02(b)") to names. */
export function resolveRepsCoveredText(text, nameBySec) {
  let s = String(text || '');
  if (!s) return s;
  const names = nameBySec || {};
  // "Section 3.02(b) through Section 3.02(e)" → "Section 3.02(b) through (e)"
  // so the resolved name isn't repeated on both ends of a range.
  s = s.replace(
    /Section\s+(\d+(?:\.\d+)*)((?:\([a-z0-9]+\))+)\s+through\s+Section\s+\1((?:\([a-z0-9]+\))+)/gi,
    (all, base, from, to) => `Section ${base}${from} through ${to}`,
  );
  return s.replace(/Section\s+(\d+(?:\.\d+)*)((?:\([a-z0-9]+\))*)/gi, (all, base, subs) => {
    const exact = names[`${base}${subs || ''}`];
    if (exact) return exact;
    const byBase = names[base];
    if (byBase) return subs ? `${byBase} ${subs}` : byBase;
    return all; // unresolvable — keep the verbatim cite
  });
}

export function buildBringdownTierLines(tiers, nameBySec) {
  const list = Array.isArray(tiers) ? tiers.filter((t) => t && typeof t === 'object') : [];
  return list.map((tier) => {
    const covered = String(tier.reps_covered || tier.repsCovered || '').trim();
    const group = covered
      ? resolveRepsCoveredText(covered, nameBySec)
      : 'Specified reps';
    // Catch-all detection kept ONLY for muted styling — never relabels,
    // reorders, or dedupes.
    const general = /^all\s+(?:company\s+|parent\s+)?representations/i.test(covered)
      || /\ball\s+other\s+(?:reps|representations)\b/i.test(covered);
    return { group, std: bringdownStandardHeadline(tier), general };
  });
}

/* ══════════════════════════════════════════════════════════════════════════
 * BLOCK 3f — Officer's certificate: parse the certified-section cites from
 * the certificationRequired quote and resolve each against the sibling
 * condition rows, rendering names ("reps bring-down, covenant performance,
 * no MAE"), not cites.
 * famRows: [{ label, matches: [{ sectionNumber, fullText }] }]
 * ══════════════════════════════════════════════════════════════════════════ */
export function parseCertifiedSectionCites(quote) {
  const s = String(quote || '');
  const out = [];
  for (const m of s.matchAll(/Sections?\s+(\d+(?:\.\d+)*)\s*((?:\([a-z0-9]+\))*)/gi)) {
    out.push({ base: m[1], subs: (m[2] || '').toLowerCase(), cite: `${m[1]}${(m[2] || '').toLowerCase()}` });
  }
  return out;
}

export function certShortName(label) {
  const l = String(label || '');
  if (/bring[\s-]*down/i.test(l)) return 'reps bring-down';
  if (/covenant/i.test(l)) return 'covenant performance';
  if (/material\s+adverse\s+effect|\bmae\b/i.test(l)) return 'no MAE';
  return l.replace(/\s*\((?:Parent|Buyer|Target|Company)\)\s*$/i, '').toLowerCase();
}

// A condition provision's identifying keys: its stamped features.sectionNumber
// (when the extractor captured one) and the leading clause letter of its
// verbatim text ("(a) Representations and Warranties. …" → "(a)").
function conditionSectionKeys(match) {
  const keys = { full: null, clause: null };
  const sec = String(match.sectionNumber || '').toLowerCase().trim();
  if (sec) keys.full = sec;
  const m = String(match.fullText || '').match(/^\s*\(([a-z0-9]+)\)/i);
  if (m) keys.clause = `(${m[1].toLowerCase()})`;
  return keys;
}

export function resolveCertifiedConditions(quote, famRows) {
  const cites = parseCertifiedSectionCites(quote);
  if (cites.length === 0) return [];
  const rows = (famRows || []).filter((r) => !/officer.?s\s+certificate/i.test(String(r.label || '')));
  const names = [];
  for (const cite of cites) {
    let hitLabel = null;
    // 1. Exact features.sectionNumber match ("7.02(a)" or bare "7.02").
    for (const r of rows) {
      for (const match of r.matches || []) {
        const keys = conditionSectionKeys(match);
        if (keys.full && (keys.full === cite.cite || keys.full === cite.base)) { hitLabel = r.label; break; }
      }
      if (hitLabel) break;
    }
    // 2. Clause-letter fallback: family sub-conditions are typically stored
    //    with their leading "(a)"/"(b)" clause marker but no stamped section
    //    number; the cite's own clause letter identifies them within the
    //    family.
    if (!hitLabel && cite.subs) {
      const firstSub = (cite.subs.match(/\([a-z0-9]+\)/) || [])[0] || null;
      if (firstSub) {
        for (const r of rows) {
          for (const match of r.matches || []) {
            const keys = conditionSectionKeys(match);
            if (!keys.full && keys.clause === firstSub) { hitLabel = r.label; break; }
          }
          if (hitLabel) break;
        }
      }
    }
    if (hitLabel) {
      const short = certShortName(hitLabel);
      if (!names.includes(short)) names.push(short);
    }
  }
  return names;
}

/* ══════════════════════════════════════════════════════════════════════════
 * BLOCK 3g — Outside-date extension detail. Reads the TERMR-OUTSIDE features'
 * stored text and derives a faithful one-liner:
 *   - "Automatic extension [to DATE]" when the source says the date extends
 *     automatically;
 *   - "Either party may elect to extend [to DATE]" when the source supports
 *     an election by either party;
 *   - appends "— available only if all other conditions remain capable of
 *     satisfaction" when the source says so.
 * Returns null when the features carry no extension signal (never invents).
 * ══════════════════════════════════════════════════════════════════════════ */
export function buildOutsideDateExtensionDetail(features) {
  const f = features || {};
  const texts = [
    ...collectTexts(f.extensionConditions),
    ...collectTexts(f.outsideDateExtensionConditions),
    ...collectTexts(f.outsideDateExtension),
    ...collectTexts(f.extensionTrigger),
    ...(typeof f.mainConcept === 'string' ? [f.mainConcept] : []),
  ];
  const joined = texts.join(' ');
  const extAvailable = unwrap(f.outsideDateExtension) === true || unwrap(f.extensionAvailable) === true;
  if (!joined && !extAvailable) return null;

  let lead;
  if (/automatic(?:ally)?/i.test(joined)) {
    lead = 'Automatic extension';
  } else if (/(?:by\s+)?either\s+(?:party|parent\s+or\s+the\s+company)[^.]{0,60}(?:elect|extend)/i.test(joined)) {
    lead = 'Either party may elect to extend';
  } else if (extAvailable) {
    lead = 'Extension available';
  } else {
    return null;
  }

  const dateM = joined.match(/extend(?:ed|s)?(?:\s+\w+){0,3}?\s+to\s+([A-Z][a-z]+\s+\d{1,2},\s+\d{4})/);
  if (dateM) lead += ` to ${dateM[1]}`;

  const capable = /all\s+other\s+(?:closing\s+)?conditions[^.]{0,200}?(?:satisfied|capable\s+of\s+being\s+satisfied)/i.test(joined);
  return capable
    ? `${lead} — available only if all other conditions remain capable of satisfaction`
    : lead;
}
