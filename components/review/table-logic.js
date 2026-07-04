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
  // FIX BATCH item 3: the only way `scope === 'partial'` reaches here with
  // `detail` still null is when `scopeField` WAS the bare enum token 'PARTIAL'
  // itself (the regex scan above always sets its own `detail` when it fires).
  // Rendering that enum back out as the "detail" produced the literal
  // "Partial: PARTIAL" — a raw enum leaking into a UI string. When there's no
  // actual descriptive text, leave detail null so the caller renders bare
  // "Partial".

  return { label, code, scope, detail, quote };
}

/* ══════════════════════════════════════════════════════════════════════════
 * FB3 — REP section Knowledge header.
 * Prefer the deal's defined "Knowledge" scope stamped by parser-v2's
 * linkKnowledgeScopeToReps over legacy rep-preamble fields. The helper stays
 * deliberately text-only so tests can pin the lawyer-visible summary without
 * rendering React.
 * ══════════════════════════════════════════════════════════════════════════ */
function cleanKnowledgeRole(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .replace(/^[,;:\s]+|[,;:\s]+$/g, '')
    .replace(/^(?:and|or)\s+/i, '')
    .replace(/\s+(?:and|or)$/i, '')
    .replace(/\s*,?\s*in\s+each\s+case$/i, '')
    .trim();
}

function splitKnowledgeRoles(text) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  if (!s) return [];
  const romanMatches = [...s.matchAll(/\(\s*(?:i|ii|iii|iv|v|vi|vii|viii|ix|x)\s*\)/gi)];
  if (romanMatches.length > 0) {
    const out = [];
    for (let i = 0; i < romanMatches.length; i += 1) {
      const start = romanMatches[i].index + romanMatches[i][0].length;
      const end = i + 1 < romanMatches.length ? romanMatches[i + 1].index : s.length;
      const role = cleanKnowledgeRole(s.slice(start, end));
      if (role) out.push(role);
    }
    return out;
  }
  return s
    .split(/\s*;\s*|\s*,\s*(?=(?:the\s+)?(?:chief|general|director|senior|svp|evp|cfo|gc|officer|president|controller|counsel|treasurer|secretary)\b)/i)
    .map(cleanKnowledgeRole)
    .filter(Boolean);
}

function groupTextFromKnowledgeScope(scope) {
  const s = String(scope || '').replace(/\s+/g, ' ').trim();
  if (!s) return [];
  const afterOf = s.match(/\b(?:actual\s+)?knowledge\s+of\s+(.+)$/i);
  let tail = afterOf ? afterOf[1] : s;
  tail = tail
    .replace(/\s*,?\s*(?:after|following)\s+(?:due|reasonable)\s+inquir(?:y|ies)\b.*$/i, '')
    .replace(/\s*,?\s*without\s+(?:due|reasonable)\s+inquir(?:y|ies)\b.*$/i, '')
    .replace(/\s*,?\s*assuming\s+(?:due|reasonable)\s+inquir(?:y|ies)\b.*$/i, '');
  return splitKnowledgeRoles(tail);
}

export function deriveKnowledgeHeader({ knowledgeScope, legacyStandard, legacyGroup } = {}) {
  const scope = typeof knowledgeScope === 'string' ? knowledgeScope.trim() : '';
  if (scope) {
    const hasReasonableInquiry = /(?:after|following)\s+(?:due|reasonable)\s+inquir(?:y|ies)\b/i.test(scope)
      || /reasonable\s+inquir(?:y|ies)\b/i.test(scope);
    let standard = null;
    if (/\bactual\s+knowledge\b/i.test(scope)) standard = 'Actual knowledge';
    else if (/\bconstructive\s+knowledge\b/i.test(scope)) standard = 'Constructive knowledge';
    else if (/\bknowledge\b/i.test(scope)) standard = 'Knowledge';
    if (standard && hasReasonableInquiry) standard += ' (after reasonable inquiry)';
    return {
      standard,
      group: groupTextFromKnowledgeScope(scope),
      quote: scope,
      source: 'definition',
    };
  }
  const group = Array.isArray(legacyGroup)
    ? legacyGroup.map((x) => (typeof x === 'string' ? x : x && x.label)).filter(Boolean)
    : (legacyGroup ? [String(legacyGroup)] : []);
  return {
    standard: legacyStandard || null,
    group,
    quote: null,
    source: 'legacy',
  };
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

/* ══════════════════════════════════════════════════════════════════════════
 * AUDIT FIX BATCH item 1 — REP-T/REP-B "Specific Features" cell: AoC (Absence
 * of Changes) "no MAE since [date]" limb + cited-covenant cross-references.
 * These two fields (aocNoMaePresent/aocNoMaeSinceDate, aocCitedCovenantNames)
 * used to leak as raw per-row COLUMNS on the reps table (aocCitedCovenantNames
 * is an array of {section, name} objects, which the generic cell stringifier
 * rendered as "[object Object]"). They belong inside the AoC rep's Specific
 * Features cell instead, with dedicated text-builders — pure text-shaping so
 * the wiring itself is unit-testable without a JSX harness (pages/review/
 * [id].js wraps the returned string in a HoverSource).
 * ══════════════════════════════════════════════════════════════════════════ */

// hasLimb: unwrapped aocNoMaePresent boolean. sinceDate: unwrapped
// aocNoMaeSinceDate string (verbatim, e.g. "January 1, 2025").
export function buildAocNoMaeLimbText(hasLimb, sinceDate) {
  if (!hasLimb) return null;
  const dateText = (typeof sinceDate === 'string' && sinceDate.trim()) ? sinceDate.trim() : null;
  return dateText ? `No MAE since ${dateText}` : 'No MAE since [date not specified]';
}

// citedCovenants: unwrapped aocCitedCovenantNames — array of { section, name }
// (post-pass resolved, never AI-populated); name null → section alone.
export function buildAocCitedCovenantsText(citedCovenants) {
  const list = Array.isArray(citedCovenants) ? citedCovenants : [];
  const text = list
    .map((item) => {
      if (item && typeof item === 'object') {
        const section = item.section ? String(item.section).trim() : '';
        const name = item.name ? String(item.name).trim() : '';
        return name ? `${section} ${name}`.trim() : section;
      }
      return String(item).trim();
    })
    .filter(Boolean)
    .join(', ');
  return text || null;
}

/* ══════════════════════════════════════════════════════════════════════════
 * AUDIT FIX BATCH item 3 — IOC General Exceptions source selection.
 * Some deals (Metsera) split their IOC preamble into party-suffixed
 * sub-clause rows (typed IOC-T/IOC-B) plus a SEPARATE bare-IOC "General
 * Exceptions" consolidated row. The old source-selection only accepted a
 * row's structured permittedExceptions/generalExceptions when it was exactly
 * `positiveProv` (found via isPreambleProvision(), category === "Preamble" /
 * "General/Preamble") — a bare "General Exceptions"-categorized row never
 * matched, so its structured pills were skipped and the raw full_text
 * regex-splitter fallback ran instead, producing a raw mid-sentence blob.
 * This pure selector mirrors the real per-provision decision so it's testable
 * without a JSX harness — pages/review/[id].js still does the isTaggedItem /
 * resolveTaggedLabel taxonomy resolution on the returned raw items.
 * ══════════════════════════════════════════════════════════════════════════ */
export function selectIocGeneralExceptionsItems(rows) {
  // rows: [{ isNegativePreamble, isPositivePreamble, isGeneralExceptionsRow,
  //          permittedExceptions, generalExceptions, source }]
  // `source` is opaque (a provision object in [id].js, a plain id in tests) —
  // this function never inspects it, only carries it through onto each
  // returned item so the caller can still attribute a pill to its provision
  // (hover/click-to-source) without this pure selector needing to know what
  // a "provision" looks like.
  const items = []; // [{ item, source }]
  let generalExceptionsRowContributed = false;
  for (const r of (rows || [])) {
    if (r.isNegativePreamble) continue;
    const include = !!r.isPositivePreamble || !!r.isGeneralExceptionsRow;
    const list = Array.isArray(r.permittedExceptions) ? r.permittedExceptions : [];
    for (const item of list) {
      const scope = item && typeof item === 'object' ? item.scope : null;
      if (include || scope === 'preamble') {
        items.push({ item, source: r.source });
        if (r.isGeneralExceptionsRow) generalExceptionsRowContributed = true;
      }
    }
    if (include) {
      const ge = Array.isArray(r.generalExceptions) ? r.generalExceptions : null;
      if (ge && ge.length > 0) {
        for (const item of ge) items.push({ item, source: r.source });
        if (r.isGeneralExceptionsRow) generalExceptionsRowContributed = true;
      }
    }
  }
  // The raw full_text regex-splitter fallback must be skipped once the
  // general-exceptions row has already contributed structured items — running
  // it anyway would duplicate the clean pills with a raw-text blob of the
  // same data (the audit-fix-batch item 3 symptom).
  return { items, skipTextFallback: generalExceptionsRowContributed };
}

/* ══════════════════════════════════════════════════════════════════════════
 * FIX BATCH item 1 — IOC General Exceptions: 4th pill dropped.
 * Metsera's General Exceptions preamble strings together FOUR distinct
 * carve-outs ("...Company Disclosure Letter ... or otherwise expressly
 * required by this Agreement ... or required by Law ... or with Parent's
 * consent"), each tagged with its own EXCEPTION_CODES code
 * (COMPANY_DISCLOSURE_LETTER / REQUIRED_BY_AGREEMENT / REQUIRED_BY_LAW /
 * PRIOR_WRITTEN_CONSENT) — but the page's old CODE_ALIAS collapsed
 * REQUIRED_BY_AGREEMENT into COMPANY_DISCLOSURE_LETTER (a leftover from an
 * earlier composite-carve-out rule that taxonomy.js itself has since
 * reversed: REQUIRED_BY_AGREEMENT now has its own distinct label,
 * "As contemplated by this Agreement"), so only 3 pills ever rendered.
 * REQUIRED_BY_AGREEMENT must NOT be aliased away — every other alias here
 * intentionally collapses genuine near-duplicates (the two disclosure-cite
 * codes, the two consent codes).
 * ══════════════════════════════════════════════════════════════════════════ */
export const IOC_EXCEPTION_CODE_ALIAS = {
  DISCLOSURE_SCHEDULE: 'COMPANY_DISCLOSURE_LETTER',
  WRITTEN_CONSENT: 'PRIOR_WRITTEN_CONSENT',
};

/** Collapse near-duplicate exception codes and dedupe by canonical code,
 *  re-resolving each surviving entry's label from `exceptionCodesDict` (the
 *  canonical taxonomy dictionary) keyed off the ALIASED code so an aliased
 *  item reads as its canonical pill's label. entries: [{ code, label, ... }].
 *  Order-preserving — first occurrence of each canonical code wins. */
export function dedupeIocExceptionEntries(entries, exceptionCodesDict) {
  const dict = exceptionCodesDict || {};
  const seen = new Set();
  const out = [];
  for (const entry of (entries || [])) {
    if (!entry || !entry.code) continue;
    const canonical = IOC_EXCEPTION_CODE_ALIAS[entry.code] || entry.code;
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    const dictLabel = dict[canonical];
    out.push({ ...entry, code: canonical, label: dictLabel || entry.label });
  }
  return out;
}

/* ══════════════════════════════════════════════════════════════════════════
 * AUDIT FIX BATCH item 4 — IOC negative-covenant row naming.
 * Several deals (Metsera) reuse the SAME raw category text for every
 * sub-clause under a combined article header ("Mergers, Acquisitions,
 * Dispositions" x3, "Indebtedness" x2) — even though each row already
 * carries its OWN resolved canonical code. Build the display label from that
 * code's canonical taxonomy label; if rows still collide after that, append
 * the row's own section-number pill as a final disambiguator. Never touches
 * stored data — display only.
 * ══════════════════════════════════════════════════════════════════════════ */
export function buildIocRowDisplayLabels(rows) {
  // rows: [{ key, canonicalLabel, fallbackLabel, sectionNumber }]
  const counts = new Map();
  for (const r of (rows || [])) {
    const l = r.canonicalLabel || r.fallbackLabel || 'General';
    counts.set(l, (counts.get(l) || 0) + 1);
  }
  const labelByKey = new Map();
  for (const r of (rows || [])) {
    const base = r.canonicalLabel || r.fallbackLabel || 'General';
    const label = (counts.get(base) || 0) <= 1
      ? base
      : (r.sectionNumber ? `${base} — ${r.sectionNumber}` : base);
    labelByKey.set(r.key, label);
  }
  return labelByKey;
}

/* ══════════════════════════════════════════════════════════════════════════
 * FIX BATCH item 2 (second half) — equity-instrument vesting inheritance.
 * A CONSID-EQUITY provision can emit MORE outstandingInstruments than
 * instrumentTreatments/instrumentVesting entries (Metsera: 3 instruments —
 * Stock Options, Restricted Stock, ESPP — but only 1 instrumentVesting entry,
 * the options' own double-trigger clause). Naively falling back to the
 * section-wide `vestingAcceleration` field for every instrument lacking its
 * OWN positional entry hands that same double-trigger language to RSAs/ESPP
 * too, which is a different instrument's clause, not theirs — implausible
 * and lawyer-visible. The section-wide field only unambiguously describes
 * THIS instrument when it is the section's ONLY instrument; otherwise render
 * nothing so the caller falls back to "—" instead of guessing.
 * ══════════════════════════════════════════════════════════════════════════ */
export function resolveInstrumentVesting(index, vestings, sectionWideVesting, instrumentCount) {
  const list = Array.isArray(vestings) ? vestings : [];
  const own = list[index];
  if (own !== undefined && own !== null) return own;
  if (instrumentCount === 1) return sectionWideVesting ?? null;
  return null;
}

/* ══════════════════════════════════════════════════════════════════════════
 * FIX BATCH item 6 — tail-arming scenario truncation.
 * The tail-arming trigger label is often a single long clause (Metsera:
 * "Deal is terminated on specified grounds and an alternative takeover
 * transaction with a bidder that was on the table is consummated, or a
 * definitive agreement for it is signed and later consummated, within twelve
 * months" — 218 chars, COMPLETE in storage). A short/aggressive char-count
 * cutoff lands mid-clause ("...with a bidder that was on the table is…"),
 * which reads as a dangling, incomplete sentence even though it technically
 * stopped at a word boundary. Prefer ending at the last CLAUSE boundary
 * (", " / "; ") within the slice when one exists reasonably far in — that
 * reads as a complete thought — before falling back to a plain word boundary,
 * then a hard cut. The full text is always still reachable via hover
 * (HoverSource quote), so no completion is ever fabricated here.
 * ══════════════════════════════════════════════════════════════════════════ */
export function truncateAtWordBoundary(text, max) {
  const s = String(text || '');
  if (s.length <= max) return s;
  const slice = s.slice(0, max);
  const lastClause = Math.max(slice.lastIndexOf(', '), slice.lastIndexOf('; '));
  if (lastClause > max * 0.3) {
    return `${slice.slice(0, lastClause).trim()}…`;
  }
  const lastSpace = slice.lastIndexOf(' ');
  const safe = lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice;
  return `${safe.trim()}…`;
}

/* ══════════════════════════════════════════════════════════════════════════
 * FIX BATCH item 5 — SECTION-LEFTOVER gating.
 * SECTION-LEFTOVER provisions are internal coverage-plumbing (the 100%-
 * text-coverage backfill for spans no provision claimed) — useful for an
 * editor auditing extraction completeness, meaningless (and confusing) to a
 * reviewer in read-only USER mode. Gate them to edit mode only, at the single
 * choke point feeding every downstream grouping/sidebar/filter view so the
 * type never has to be re-excluded per render path.
 * ══════════════════════════════════════════════════════════════════════════ */
export function filterProvisionsForViewMode(provisions, isEdit) {
  const list = Array.isArray(provisions) ? provisions : [];
  if (isEdit) return list;
  return list.filter((p) => p && p.type !== 'SECTION-LEFTOVER');
}

/* ══════════════════════════════════════════════════════════════════════════
 * FB3 item 2 — AoC rep row: one pill per limb actually present.
 * The AoC ("Absence of Certain Changes") rep bundles up to three independent
 * limbs: a "no MAE since [date]" prong, an ordinary-course prong, and
 * (layered on top of the ordinary-course prong) cited-covenant "specific
 * IOC" cross-references. Never label this "General operating covenant" (the
 * raw absenceOfChangesType taxonomy label) — that reads as if nothing
 * specific was cited even when covenant sections were. Returns
 * [{ key, label, quote }] — quote is hover-only, never printed inline.
 * ══════════════════════════════════════════════════════════════════════════ */
export function buildAocTermPills(features) {
  const f = features || {};
  const pills = [];

  const noMaeRaw = f.aocNoMaePresent;
  if (unwrap(noMaeRaw) === true) {
    const dateRaw = f.aocNoMaeSinceDate;
    const dateInner = unwrap(dateRaw);
    const quote = collectTexts(dateRaw)[0] || collectTexts(noMaeRaw)[0] || null;
    const label = buildAocNoMaeLimbText(true, typeof dateInner === 'string' ? dateInner : null) || 'No MAE';
    pills.push({ key: 'noMae', label, quote });
  }

  const citedRaw = f.aocCitedCovenantNames;
  const citedInner = unwrap(citedRaw);
  const hasCited = Array.isArray(citedInner) && citedInner.length > 0;
  const ocRaw = f.aocOrdinaryCourseLimb;
  const ocInner = unwrap(ocRaw);
  const hasOc = typeof ocInner === 'string' && ocInner.trim().length > 0;

  if (hasCited) {
    // Cited covenant sections turn the ordinary-course limb into (in
    // substance) a set of specifically-enumerated IOCs.
    const quote = collectTexts(citedRaw)[0] || (hasOc ? ocInner : null);
    pills.push({ key: 'iocs', label: 'Specific IOC carve-outs', quote });
  } else if (hasOc) {
    pills.push({ key: 'oc', label: 'Ordinary course', quote: ocInner });
  }

  return pills;
}

/* ══════════════════════════════════════════════════════════════════════════
 * FB3 item 3 — scope-qualified pill text: "(partial)" renders INSIDE the
 * pill's own label, in parens, never as separate sibling text. Nothing extra
 * renders when scope is absent or "entire" — the unmarked pill IS the
 * "applies to the whole rep" case. Shared by knowledgeQualifier (existing
 * `display.scope` from knowledgeQualifierDisplay above) and
 * materialityQualifier (the concurrent extraction agent's new `scope` field).
 * ══════════════════════════════════════════════════════════════════════════ */
export function withScopeParens(label, scope) {
  return scope === 'partial' ? `${label} (partial)` : label;
}

// materialityQualifier's scope value (ENTIRE_REP / PARTIAL) uses the same
// vocabulary as knowledgeQualifierDisplay's own scope detection — normalize
// both the same way so "(partial)" means the same thing on either pill.
export function normalizeQualifierScope(raw) {
  if (typeof raw !== 'string') return null;
  const s = raw.trim().toUpperCase();
  if (s === 'PARTIAL') return 'partial';
  if (s === 'ENTIRE' || s === 'ENTIRE_REP' || s === 'WHOLE_REP') return 'entire';
  return null;
}

/* ══════════════════════════════════════════════════════════════════════════
 * FB3 item 4(a) — D&O Insurance Cap concise form: derive "N% of annual
 * premium" from the verbatim clause. Never invents a number — returns null
 * (caller falls back to a truncated verbatim snippet) when no percentage or
 * dollar figure is found near "premium".
 * ══════════════════════════════════════════════════════════════════════════ */
export function deriveInsuranceCapConcise(text) {
  if (typeof text !== 'string' || !text.trim()) return null;
  const pct = text.match(/(\d+(?:\.\d+)?)\s*%\)?\s*of\s+the\s+(?:then-current\s+|current\s+)?annual\s+premium/i);
  if (pct) return `${pct[1]}% of annual premium`;
  const dollar = text.match(/\$[\d,]+(?:\.\d+)?(?:\s*(?:million|billion|thousand|mm|k))?/i);
  if (dollar && /premium/i.test(text)) return dollar[0].trim();
  return null;
}

/* ══════════════════════════════════════════════════════════════════════════
 * FB3 item 4(d) — Access row: humanized scope label + purpose pill(s).
 * Two purpose pills when accessPurposeLimitation names BOTH consummation and
 * integration-planning purposes (e.g. "solely for the purpose of
 * consummating the Transactions or integration planning purposes").
 * ══════════════════════════════════════════════════════════════════════════ */
export function humanizeAccessScopeToken(raw) {
  const s = String(raw || '').replace(/[-_]+/g, ' ').trim();
  if (!s) return null;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Returns which purpose(s) the verbatim purpose-limitation text names:
// a subset of ['consummation', 'integration'], or ['other'] when the text is
// non-empty but names neither, or [] when there's no text at all.
export function detectAccessPurposes(text) {
  if (typeof text !== 'string' || !text.trim()) return [];
  const hasConsummation = /consummat/i.test(text);
  const hasIntegration = /integrat/i.test(text);
  if (!hasConsummation && !hasIntegration) return ['other'];
  const out = [];
  if (hasConsummation) out.push('consummation');
  if (hasIntegration) out.push('integration');
  return out;
}

/* ══════════════════════════════════════════════════════════════════════════
 * FB3 item 5(d) — Jurisdiction row must NAME the courts + fallback, never a
 * bare "Yes". `jurisdictionText` (features.jurisdiction) already carries the
 * fallback court in the same verbatim string (e.g. "Court of Chancery ...
 * (or, if such court shall be unavailable, any state or federal court ...)");
 * prefer it over the boolean exclusivity flag, which used to win the
 * pickFirstNonEmpty race and render as a content-free "Yes".
 * ══════════════════════════════════════════════════════════════════════════ */
export function buildJurisdictionDisplay({ jurisdictionText, jurisdictionExclusive, jurisdictionExclusiveText }) {
  let text = (typeof jurisdictionText === 'string' && jurisdictionText.trim()) ? jurisdictionText.trim() : null;
  if (!text && typeof jurisdictionExclusiveText === 'string' && jurisdictionExclusiveText.trim()) {
    // No court-name text extracted — never invent one. Fall back to the
    // exclusivity clause's own verbatim text rather than a bare "Yes".
    text = jurisdictionExclusiveText.trim();
  }
  if (!text) return null;
  return { text, exclusive: jurisdictionExclusive === true };
}

/* ══════════════════════════════════════════════════════════════════════════
 * FB3 item 5(e) — Fees & Expenses: "Parties pay own expenses except for
 * [resolved §-refs]". Resolve each cited section against the deal's OWN
 * sections (by sectionNumber, matched on the base number so "6.03(b)"
 * resolves against a provision classified at "6.03"). An unresolvable cite
 * keeps the bare citation — never invented.
 * ══════════════════════════════════════════════════════════════════════════ */
export function extractSectionRefs(text) {
  if (typeof text !== 'string') return [];
  const matches = text.match(/Section\s+\d+(?:\.\d+)*(?:\([a-z0-9]+\))?/gi) || [];
  const seen = new Set();
  const out = [];
  for (const m of matches) {
    const norm = m.replace(/\s+/g, ' ').trim();
    if (!seen.has(norm)) { seen.add(norm); out.push(norm); }
  }
  return out;
}

// sectionIndex: [{ sectionNumber: '6.02', category: 'Access to Information...' }, ...]
// (already-unwrapped plain strings — the caller does the citable unwrap).
export function resolveSectionRef(ref, sectionIndex) {
  const m = ref.match(/([\d.]+)/);
  if (!m) return ref;
  const baseNum = m[1].replace(/\.$/, '');
  for (const entry of sectionIndex || []) {
    const sec = entry && entry.sectionNumber;
    if (typeof sec !== 'string') continue;
    const secBase = sec.replace(/\([a-z0-9]+\)\s*$/i, '').trim();
    if (secBase === baseNum) return `${ref} (${entry.category})`;
  }
  return ref;
}

export function buildFeeExpenseSentence(text, sectionIndex) {
  if (typeof text !== 'string' || !text.trim()) return null;
  const refs = extractSectionRefs(text);
  if (refs.length === 0) return 'Parties pay their own fees and expenses.';
  const resolved = refs.map((r) => resolveSectionRef(r, sectionIndex));
  return `Parties pay their own fees and expenses, except for ${resolved.join(', ')}.`;
}

/* ══════════════════════════════════════════════════════════════════════════
 * FB3 item 4(e) — Public Statements: the Parent/Company carveout booleans
 * collapse into ONE deduped "Exceptions" list (they're near-always identical
 * text on a single deal) rather than two separate near-duplicate rows.
 * ══════════════════════════════════════════════════════════════════════════ */
export function dedupeTexts(texts) {
  const seen = new Set();
  const out = [];
  for (const t of texts || []) {
    const norm = typeof t === 'string' ? t.trim() : '';
    if (norm && !seen.has(norm)) { seen.add(norm); out.push(norm); }
  }
  return out;
}

export function canonicalizeNosolPills(raw, vocabName) {
  const vocab = NOSOL_PILL_VOCAB[vocabName] || [];
  const out = [];
  const seen = new Set();
  for (const item of itemsFromRaw(raw)) {
    const text = firstText(item);
    if (!text) continue;
    let matched = false;
    for (const def of vocab) {
      if (!def.patterns.some((re) => re.test(text))) continue;
      matched = true;
      if (!seen.has(def.code)) {
        seen.add(def.code);
        out.push({ type: 'pill', code: def.code, label: def.label, quote: text });
      }
    }
    if (!matched) {
      out.push({ type: 'pill', code: 'OTHER', label: 'Other', quote: text });
    }
  }
  return out;
}

export function goShopDisplay(provisions) {
  const period = pickNosolFeature(provisions, ['goShopPeriodDays', 'goShopWindow']);
  const excluded = pickNosolFeature(provisions, ['goShopExcludedParties']);
  const extended = pickNosolFeature(provisions, ['extendedNegotiatingPeriodDays']);
  const present = pickNosolFeature(provisions, ['goShopPresent']);
  const presentValue = present ? unwrap(present.value) : null;
  const hasGoShop = presentValue === true || !!period || !!excluded || !!extended;
  return {
    present: hasGoShop,
    rows: [
      { label: 'Go-Shop Period', hit: period },
      { label: 'Go-Shop Excluded Parties', hit: excluded },
      { label: 'Extended Negotiating Period', hit: extended },
    ],
  };
}

export const NOSOL_COR_LIFECYCLE_LABELS = [
  'What constitutes a Change of Recommendation',
  'What does NOT constitute a Change of Recommendation',
  'Engagement standard (to discuss with a third party)',
  'Notice period',
  'Notice content',
  'Standstill waiver permitted',
  'Anti-clubbing waiver permitted',
  'Initial match period',
  'Subsequent match period',
  'Change-of-recommendation standard',
  'Material improvement standard',
];

export function nosolDefinitionInitialState(labels) {
  return new Set((labels || []).filter(Boolean));
}

export function noticePeriodParts(raw) {
  const quote = firstText(raw) || null;
  const value = unwrap(raw);
  const text = `${quote || ''} ${value === null || value === undefined ? '' : String(value)}`;
  const parts = [];
  if (/promptly|as promptly as reasonably practicable/i.test(text)) {
    parts.push({ label: 'Promptly', quote });
  }
  const capMatch = text.match(/(?:within|later than|no event later than)[^.\n;]{0,50}?(\d+|twenty-four|forty-eight|96)\s*(hours?|business days?|calendar days?)/i)
    || text.match(/\b(\d+)\s*(hours?|business days?|calendar days?)\b/i);
  if (capMatch) {
    const n = capMatch[1].toLowerCase() === 'twenty-four' ? '24'
      : capMatch[1].toLowerCase() === 'forty-eight' ? '48'
        : capMatch[1];
    const unit = capMatch[2].toLowerCase().replace(/s$/, '');
    parts.push({ label: `${n} ${unit}${String(n) === '1' ? '' : 's'}`, quote });
  } else if (typeof value === 'number') {
    parts.push({ label: `${value} hours`, quote });
  }
  return parts.length > 0 ? parts : null;
}

export function pickNosolFeature(provisions, keys) {
  for (const p of (provisions || [])) {
    const f = nosolFeatures(p);
    for (const k of (keys || [])) {
      const v = f[k];
      if (v === null || v === undefined || v === '' || v === false) continue;
      if (Array.isArray(v) && v.length === 0) continue;
      return { value: v, key: k, provision: p };
    }
  }
  return null;
}

function firstText(raw) {
  const texts = collectTexts(raw);
  if (texts.length > 0) return texts.join('\n\n');
  const inner = unwrap(raw);
  if (inner === null || inner === undefined) return '';
  if (Array.isArray(inner)) return inner.map((x) => firstText(x)).filter(Boolean).join('\n\n');
  if (typeof inner === 'object') return JSON.stringify(inner);
  return String(inner);
}

function itemsFromRaw(raw) {
  const inner = unwrap(raw);
  if (Array.isArray(inner)) return inner;
  if (inner === null || inner === undefined || inner === '' || inner === false) return [];
  return [inner];
}

export function prohibitedActPills(provisions) {
  const hit = pickNosolFeature(provisions, ['ceaseDiscussionsProhibitedList']);
  const items = itemsFromRaw(hit && hit.value);
  const quoteFor = (re) => {
    for (const item of items) {
      const text = firstText(item);
      if (re.test(text)) return text;
    }
    return hit ? firstText(hit.value) : null;
  };
  return [
    {
      label: 'Cease all discussions',
      quote: quoteFor(/cease|terminat|discussion|negotiation|solicitation|activity/i),
    },
    {
      label: 'Terminated diligence access',
      quote: quoteFor(/data room|access|non-public information|books|records|diligence|return|destroy|confidential information/i),
    },
  ];
}

export function representativeStandardDisplay(raw) {
  const quote = firstText(raw) || null;
  const value = unwrap(raw);
  const text = typeof value === 'string' ? value : '';
  const upper = text.toUpperCase();
  let label = null;
  if (upper === 'RBE_NOT_TO' || /reasonable\s+best\s+efforts/i.test(text)) label = 'Reasonable best efforts';
  else if (upper === 'INSTRUCT_NOT_TO' || /\binstruct|direct/i.test(text)) label = 'Instruct / direct';
  else if (upper === 'CAUSE_NOT_TO' || /\bcause\b/i.test(text)) label = 'Cause';
  else if (upper === 'NA') label = 'Not applicable';
  else if (text) label = text;
  return label ? { label, quote } : null;
}

export function superiorProposalLimbs(raw) {
  const quote = firstText(raw) || null;
  const source = String(unwrap(raw) || '').replace(/\s+/g, ' ').trim();
  if (!source) return [];
  const paren = source.match(/\((?:i|x|A)\)\s*(.+?)\s+(?:and\s+)?\((?:ii|y|B)\)\s*(.+)$/i);
  let limbs = paren ? [paren[1], paren[2]] : [];
  if (limbs.length === 0) {
    const semi = source.match(/(.+?financial point of view[^;]*);?\s+and\s+(.+)/i);
    if (semi) limbs = [semi[1], semi[2]];
  }
  if (limbs.length === 0) {
    const likelyFirst = source.match(/^(is likely to be consummated.*?)\s+and\s+(would.*more favorable.*)$/i);
    if (likelyFirst) limbs = [likelyFirst[2], likelyFirst[1]];
  }
  if (limbs.length === 0) limbs = [source];
  return limbs.slice(0, 2).map((text, idx) => ({
    label: idx === 0 ? 'Value limb' : 'Deliverability limb',
    text: text.replace(/^\s*that,\s*/i, '').trim(),
    quote,
  }));
}

export const NOSOL_PILL_VOCAB = {
  changeOfRecommendationItems: [
    {
      code: 'WITHDRAW_OR_ADVERSE_MODIFY_RECOMMENDATION',
      label: 'Withdraw or adverse-modify recommendation',
      patterns: [
        /\b(withhold|withdraw|amend|change|qualify|modify|fail to make|fail to include).{0,140}(recommendation|schedule 14d-9|proxy statement)/i,
      ],
    },
    {
      code: 'APPROVE_OR_RECOMMEND_COMPETING_PROPOSAL',
      label: 'Approve or recommend competing proposal',
      patterns: [
        /\b(approve|adopt|endorse|recommend|declare advisable).{0,120}(acquisition|takeover|competing|alternative transaction|proposal)/i,
      ],
    },
    {
      code: 'FAIL_TO_REAFFIRM_ON_REQUEST',
      label: 'Fail to reaffirm on request',
      patterns: [
        /fail.{0,120}(reaffirm|republish|publicly recommend against).{0,150}(request|parent|business days)/i,
      ],
    },
    {
      code: 'FAIL_TO_RECOMMEND_AGAINST_TENDER_OFFER',
      label: 'Fail to recommend against tender offer within required period',
      patterns: [
        /(tender|exchange).{0,180}(fail to recommend against|recommend against acceptance|solicitation\/recommendation statement|schedule 14d-9|formal action|public statement)/i,
      ],
    },
    {
      code: 'APPROVE_ALTERNATIVE_AGREEMENT',
      label: 'Approve alternative agreement',
      patterns: [
        /(alternative|acquisition|transaction).{0,70}agreement|letter of intent|memorandum of understanding|agreement in principle|cause or permit.{0,120}enter|enter into.*agreement/i,
      ],
    },
  ],
  notChangeOfRecommendationItems: [
    {
      code: 'EXCHANGE_ACT_DISCLOSURE_COMPLIANCE',
      label: '14d-9 / 14e-2 stop-look-listen compliance',
      patterns: [
        /14d-9|14e-2|1012|regulation m-a|stop,? ?look(?:-| )?and(?:-| )?listen|take no position/i,
      ],
    },
    {
      code: 'FACTUAL_ACCURATE_DISCLOSURE',
      label: 'Factually accurate disclosure',
      patterns: [
        /factual|factually accurate|only describes|receipt of .*proposal|bidder'?s identity|identity of .*party|material terms|reaffirm/i,
      ],
    },
    {
      code: 'ROUTINE_COMMUNICATIONS',
      label: 'Routine communications',
      patterns: [
        /informing any person|existence of the provisions|determination .*superior proposal|delivery .*notice|not unanimous|required by applicable law|comply with applicable law|inconsistent with applicable law/i,
      ],
    },
  ],
  noticeContent: [
    {
      code: 'IDENTITY',
      label: 'Identity',
      patterns: [/identity|name of such person|person or group|party making|person making|group/i],
    },
    {
      code: 'MATERIAL_TERMS',
      label: 'Material terms',
      patterns: [/material terms|terms and conditions|basis for|details/i],
    },
    {
      code: 'COPIES_OF_PROPOSAL',
      label: 'Copies of Proposal',
      patterns: [/copies|copy|draft|written request|proposed agreements|ancillary documents|written communications|relevant documents|documentation|financing commitments/i],
    },
    {
      code: 'DESCRIPTION_IF_NOT_IN_WRITING',
      label: 'Description if not in writing',
      patterns: [/not in writing|oral|description of (?:the )?(?:material )?terms|written summary/i],
    },
    {
      code: 'MODIFICATIONS',
      label: 'Modifications',
      patterns: [/amendment|modification|changes?|subsequent|status of any discussions|negotiations|developments/i],
    },
  ],
};

export function nosolFeatures(provision) {
  if (!provision) return {};
  if (provision.features && typeof provision.features === 'object') return provision.features;
  let meta = provision.ai_metadata;
  if (typeof meta === 'string') {
    try { meta = JSON.parse(meta); } catch { meta = null; }
  }
  if (meta && typeof meta === 'object' && meta.features && typeof meta.features === 'object') return meta.features;
  return {};
}

export function compactDoValue(featureKey, raw) {
  const val = unwrapLocal(raw);
  if (val === null || val === undefined || val === '') return null;
  if (featureKey === 'indemnificationPeriod') {
    const n = Number(val);
    if (Number.isFinite(n)) return `${n} years`;
    return String(val);
  }
  if (featureKey === 'insuranceCap') {
    const s = String(val);
    const pct = s.match(/(\d+(?:\.\d+)?)\s*%\s+of\s+(?:the\s+)?(?:current|last|annual|aggregate)?[^.;]{0,80}premium/i);
    if (pct) return `${pct[1]}% of annual premium`;
    const capName = s.match(/"([^"]*Cap Amount[^"]*)"/i);
    if (capName) return capName[1];
    const dollars = s.match(/\$\s?[\d,]+(?:\.\d+)?(?:\s*(?:million|billion|thousand))?/i);
    if (dollars) return dollars[0];
    return s.length > 90 ? `${s.slice(0, 89).trim()}...` : s;
  }
  return null;
}

export function isConsiderationGroupedProvision(provision) {
  if (!provision) return false;
  if (provision.type === 'CONSID') return true;
  if (provision.type === 'DEF') return false;
  const code = localCode(provision);
  const cat = String(provision.category || '');
  const text = String(provision.full_text || provision.text || '');
  if (code === 'CONSID-EQUITY' || code === 'CONSID-CONVERT' || code === 'CONSID-EXCHANGE-RATIO') return true;
  if (/equity\s+awards?|stock\s+plans?|treatment\s+of\s+(?:equity|stock|rsu|psu|options?)/i.test(cat)) return true;
  if (/lock[\s-]?up/i.test(cat) && /stock\s+consideration|class\s+[a-z]\s+common\s+stock|shares?\s+received|transfer/i.test(`${cat} ${text}`)) return true;
  const feats = localFeatures(provision);
  if (feats.exchangeRatio || feats.equityAwardTreatment || feats.instrumentType) return true;
  return false;
}

export function deriveHeadlineConsiderationType(provisions) {
  const list = Array.isArray(provisions) ? provisions : [];
  let hasCash = false;
  let hasStock = false;
  let hasElection = false;
  for (const item of list) {
    const f = item && (item.mainConcept || item.considerationType || item.perShareAmount || item.exchangeRatio)
      ? item
      : localFeatures(item);
    const ctRaw = unwrapLocal(f.considerationType);
    const ct = isTagged(ctRaw) ? `${ctRaw.code || ''} ${ctRaw.label || ''}` : String(ctRaw || '');
    const joined = [
      ct,
      f.proration,
      f.prorationMechanics && JSON.stringify(f.prorationMechanics),
      f.electionMechanics,
      f.exchangeRatio,
      f.exchangeRatioText,
      f.perShareAmount,
      f.cashAmount,
    ].filter(Boolean).join(' ');
    if (f.perShareAmount || f.cashAmount || /\bcash\b/i.test(joined)) hasCash = true;
    if (f.exchangeRatio || f.exchangeRatioText || /\bstock\b|share(?:s)?\s+of\b|all-stock/i.test(joined)) hasStock = true;
    if (/election|proration|mixed-cash-and-stock|mixed[_\s-]?election|cash_election|stock_election/i.test(joined)) hasElection = true;
  }
  if (hasElection) return 'MIXED_ELECTION';
  if (hasStock) return 'STOCK';
  if (hasCash) return 'CASH';
  return null;
}

export function numericDollarOnly(raw) {
  const val = unwrapLocal(raw);
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number' && Number.isFinite(val)) return `$${Math.round(val).toLocaleString('en-US')}`;
  const s = String(val);
  const paren = s.match(/\(\s*(\$\s?[\d,]+(?:\.\d+)?)\s*\)/);
  if (paren) return paren[1].replace(/\$\s+/, '$');
  const direct = s.match(/\$\s?[\d,]+(?:\.\d+)?/);
  if (direct) return direct[0].replace(/\$\s+/, '$');
  return s;
}

export function headlineConsiderationLabel(value) {
  if (value === 'CASH') return 'Cash';
  if (value === 'STOCK') return 'Stock';
  if (value === 'MIXED_ELECTION') return 'Mixed election';
  return null;
}

export function displayTypeForProvision(provision, allProvisions) {
  if (!provision) return 'Other';
  if (isConsiderationGroupedProvision(provision)) return 'CONSID';
  if (provision.type === 'IOC') {
    const code = localCode(provision);
    const affOrPreamble = /^IOC-(?:ORDINARY|PRESERVE|MAINTAIN|NOACTION|AFFIRMATIVE|OTHER-AFFIRMATIVE|GENERAL-EXCEPTIONS|EXCEPTIONS|POSITIVE-PREAMBLE)$/.test(code);
    const hasTargetIoc = (allProvisions || []).some((p) => p && p.type === 'IOC-T');
    if (affOrPreamble && hasTargetIoc) return 'IOC-T';
  }
  return provision.type || 'Other';
}

function unwrapLocal(v) {
  if (isCitable(v)) return v.value;
  return v;
}

function localCode(provision) {
  const meta = localMeta(provision);
  return String((meta && meta.code) || provision?.code || '').toUpperCase();
}

function localFeatures(provision) {
  if (!provision) return {};
  const meta = localMeta(provision);
  const feats = (meta && meta.features) || provision.features || {};
  return feats && typeof feats === 'object' && !Array.isArray(feats) ? feats : {};
}
