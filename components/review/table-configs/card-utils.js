import { partyScopeFromCode, partyLabel } from '../../../lib/party-scope.js';

function cardCode(card) {
  return String(card?.provision_subtype || card?.canonical_code || card?.provision_code || card?.code || '').trim().toUpperCase();
}

function cardType(card) {
  return String(card?.provision_type || card?.type || '').trim().toUpperCase();
}

function cardFeatures(card) {
  if (card?.features && typeof card.features === 'object') return card.features;
  const meta = card?.ai_metadata;
  if (meta?.features && typeof meta.features === 'object') return meta.features;
  return {};
}

function textOf(card) {
  return String(card?.primary_quote || card?.region_full_text || '').trim();
}

function labelOf(card) {
  return String(card?.short_title || card?.defined_term || cardCode(card) || 'Provision').trim();
}

function valueText(value) {
  if (value === null || value === undefined || value === '') return null;
  if (Array.isArray(value)) return value.map(valueText).filter(Boolean).join('; ');
  if (typeof value === 'object') {
    if (value.value !== undefined) return valueText(value.value);
    if (value.label || value.code) {
      // Tagged value shape { code, label, text, quotes }. Read view shows
      // the friendly label only; the raw canonical code is kept on the value
      // object (`.code`) for edit-mode/card-view consumers but must never be
      // re-appended to this display string. Claims backfills sometimes store
      // the code itself as `text`/`verbatim` when no distinguishing quote
      // was captured, which would otherwise double the code onto the label,
      // e.g. "One-step merger: ONE_STEP_MERGER". Only suppress `.text` when
      // it's a LITERAL echo of the code or the already-friendly label
      // (exact string match, no case-folding) -- genuine verbatim prose that
      // merely overlaps in wording with the label (e.g. label "Reasonable
      // best efforts" + text "reasonable best efforts" quoted from the
      // agreement) is real supporting evidence and must still render.
      const primary = value.label || value.code;
      const text = value.text ? String(value.text).trim() : null;
      const textIsRedundant = text !== null && (text === primary || text === value.code);
      return [primary, textIsRedundant ? null : value.text].filter(Boolean).join(': ');
    }
    // Election-mechanism objects (prorationMechanics / electionMechanics --
    // { text, quotes, electionType, electionDeadline,
    // oversubscriptionTreatment }) carry a genuine human-readable prose
    // summary in `.text`; electionType/electionDeadline/
    // oversubscriptionTreatment are per-option METADATA annotations, not a
    // substitute for it. Ben (Skechers, round 2): the row rendered
    // "electionType: MIXED_ELECTION; electionDeadline: Election Deadline"
    // instead of the actual proration language because the generic
    // field-listing fallback below picked those keys up ahead of `.text`.
    // Only kicks in when `.text` is actually populated -- a bare
    // {electionType, oversubscriptionTreatment} with no text still falls
    // through to the field-listing below, same as before.
    if (value.text && ('electionType' in value || 'electionDeadline' in value || 'oversubscriptionTreatment' in value)) {
      return String(value.text).trim() || null;
    }
    // No code/label -- either a plain feature object, or a JSON-parsed
    // structured-object attribute (e.g. interestOnLatePayment { rate, base },
    // materialContractsDollarThresholds { bucket, threshold }). Render the
    // meaningful fields rather than falling back to the raw `.text`
    // (verbatim JSON) bookkeeping field, which is what produced the
    // raw-JSON-blob read-view bug this helper now avoids.
    const fieldEntries = Object.entries(value).filter(
      ([key, val]) => key !== 'text' && key !== 'quotes' && val !== null && val !== undefined && val !== '',
    );
    if (fieldEntries.length > 0) {
      return fieldEntries
        .map(([key, val]) => {
          const rendered = valueText(val);
          return rendered ? `${key}: ${rendered}` : null;
        })
        .filter(Boolean)
        .join('; ');
    }
    return value.text ? String(value.text) : null;
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

function firstFeature(cards, keys) {
  const list = Array.isArray(keys) ? keys : [keys];
  for (const card of cards) {
    const features = cardFeatures(card);
    for (const key of list) {
      const detail = valueText(features[key]);
      if (detail) return { key, value: features[key], detail, card };
    }
  }
  return null;
}

function makeRow(prefix, id, label, kind, hit) {
  if (!hit?.detail) return null;
  return {
    id: `${prefix}-${id}`,
    label,
    kind,
    detail: hit.detail,
    evidence: textOf(hit.card),
    source: labelOf(hit.card),
    present: true,
  };
}

function mappedRows(prefix, cards, specs) {
  return specs
    .map(([id, label, kind, keys]) => makeRow(prefix, id, label, kind, firstFeature(cards, keys || id)))
    .filter(Boolean);
}

// Multi-instance counterpart to firstFeature(): where firstFeature stops at
// the FIRST card with a non-empty value (dropping every other card's data),
// allFeatures returns ONE hit PER CARD that has a value for any of the given
// keys. For families where every card is a genuinely distinct instance (a
// per-rep qualifier, a per-right termination party, a Company-vs-Parent MAE
// split), this is what stops N claims from collapsing into a single row.
function allFeatures(cards, keys) {
  const list = Array.isArray(keys) ? keys : [keys];
  const hits = [];
  for (const card of cards || []) {
    const features = cardFeatures(card);
    for (const key of list) {
      const detail = valueText(features[key]);
      if (detail) {
        hits.push({ key, value: features[key], detail, card });
        break; // first matching alias wins for THIS card; still visit every other card
      }
    }
  }
  return hits;
}

// Builds one row per hit (see allFeatures) instead of makeRow's single row.
// Row ids are suffixed by the source card id so React keys stay stable and
// unique even when several cards share the same row label.
function makeRows(prefix, id, label, kind, hits) {
  return (hits || []).map((hit, index) => ({
    id: `${prefix}-${id}-${hit?.card?.id || index}`,
    label,
    kind,
    detail: hit.detail,
    evidence: textOf(hit.card),
    source: labelOf(hit.card),
    value: hit.value,
    featureKey: hit.key,
    sourceCard: hit.card,
    present: true,
  }));
}

function mappedRowsMulti(prefix, cards, specs) {
  return specs.flatMap(([id, label, kind, keys]) => makeRows(prefix, id, label, kind, allFeatures(cards, keys || id)));
}

function selectCards(reviewDeal, predicate) {
  return (reviewDeal?.cards || []).filter(predicate);
}

// Phase B compact-column reshaping: the pure truncation math behind
// ProvisionTablePrimitives.jsx's <TruncatedWithSeeText>, split out into
// plain JS so it's testable under `node --test` without a JSX loader (the
// primitive itself lives in a .jsx file the test runner can't import
// directly — see tests/review/provision-table-compact-columns.spec.js).
// Word-boundary-trims the preview so it never cuts mid-word.
function splitForCell(text, max = 160) {
  const value = text === null || text === undefined ? '' : String(text);
  if (!value) return { value: '', short: '', truncated: false };
  if (value.length <= max) return { value, short: value, truncated: false };
  const cut = value.slice(0, max);
  const short = (cut.replace(/\s+\S*$/, '').trim() || cut.trim());
  return { value, short, truncated: true };
}

// Strips the "[PROPOSED]" prefix ingestion attaches to fragment/unclassified
// cards (see review-deal.js's stripProposedShortTitle) -- used when such a
// card's own short_title is reused as a resolved SUBJECT name elsewhere
// (e.g. a section citation resolver), so the raw ingestion marker doesn't
// leak into read-view prose.
function stripProposedTitle(title) {
  return typeof title === 'string' ? title.replace(/^\[PROPOSED\]\s*/, '').trim() : title;
}

// Extracts every "Section X.Y(z)" / "Article N" citation from a text blob,
// each carrying a compact display form ("§X.Y(z)" for Sections, the literal
// "Article N" for Articles) plus its character offset so callers can pair a
// citation with whichever nearby fact mentions it (see
// misc-boilerplate.config.js's nearest-by-distance beneficiary pairing).
// Shared by advisers-fees-expenses.config.js (AF1: naming fee/expense
// exception sections) and misc-boilerplate.config.js (TB1: naming
// third-party-beneficiary sections) so both tables resolve section
// citations the same way.
// Trailing lookahead (not `\b`) deliberately: `\b` fails right after a
// subsection paren like "6.03(b)" because ")" and the following "," are
// both non-word characters, so `\b` never fires there and the match
// silently backtracks to just "6.03", dropping the "(b)".
const SECTION_CITE_RE = /\b(Section|Article)s?\s+([0-9]+(?:\.[0-9]+)*(?:\([a-zA-Z0-9]+\))*|[IVXLCivxlc]+)(?![\w(])/g;

function extractSectionCites(text) {
  if (!text) return [];
  const refs = [];
  const re = new RegExp(SECTION_CITE_RE.source, 'gi');
  let match;
  while ((match = re.exec(String(text)))) {
    const isArticle = /article/i.test(match[1]);
    const number = match[2];
    refs.push({
      raw: match[0],
      number,
      kind: isArticle ? 'Article' : 'Section',
      display: isArticle ? `Article ${number}` : `§${number}`,
      index: match.index,
    });
  }
  return refs;
}

// Resolves a cited Section NUMBER (e.g. "6.05") to the SUBJECT of that
// section -- what it's actually about -- by looking across every card in the
// deal (not just whichever subset the calling table already selected) for a
// section whose own heading or section_ref matches. Two tiers, both grounded
// in real per-card data (never fabricated):
//  1. The card's own quoted text usually starts with its literal heading
//     ("SECTION 6.05. Indemnification. ...") -- most reliable, since it's
//     independent of how the ingestion pipeline grouped/labeled the region.
//  2. The card's section_ref column (e.g. "6.05 | D&O Indemnification and
//     Insurance | <hash>"), which is usually right but can lag the true
//     document numbering for fragment/[PROPOSED] cards (see FEEDBACK-3
//     punchlist item I7 for the same class of gap).
// Only Section citations are indexed here -- Article citations aren't
// resolved (no reliable per-card article heading to match against).
const HEADING_SECTION_RE = /^SECTION\s+([0-9]+(?:\.[0-9]+)*(?:\([a-zA-Z0-9]+\))*)\.?/i;

function buildSectionSubjectResolver(allCards) {
  const byHeading = new Map();
  const byRef = new Map();
  for (const card of allCards || []) {
    const headingMatch = HEADING_SECTION_RE.exec(textOf(card));
    if (headingMatch && !byHeading.has(headingMatch[1])) byHeading.set(headingMatch[1], card);
    const refNumber = String(card?.section_ref || '').split('|')[0].trim();
    if (refNumber && !byRef.has(refNumber)) byRef.set(refNumber, card);
  }
  return function resolveSectionSubject(number) {
    const card = byHeading.get(number) || byRef.get(number);
    if (!card) return null;
    return {
      subject: stripProposedTitle(labelOf(card)),
      evidence: textOf(card),
      source: labelOf(card),
      sourceCard: card,
    };
  };
}

// Canonical party-side label. Single source of truth for "whose obligation
// is this" across the review UI — replaces the byte-identical partySide()
// copies that had drifted into the four nosol-*.config.js files.
//
// The party token in the provision code/subtype (REP-B-ORG, COND-S-*,
// TERMF-TARGET, IOC-T ...) is the RELIABLE signal — the stored
// party_scope is a uniform 'MUTUAL' default baked in by store-cards.js, so it
// is treated as no-signal unless it's an explicit NON-mutual value. Codes
// with no party token (IOC-ISSUE, NOSOL-PROHIBIT — category-based subtypes
// whose party lived on the now-dropped provision type) default to Target,
// which is correct for the overwhelming single-party majority; the rare
// buyer-side / merger-of-equals cases are recovered when store-cards re-mints
// party_scope from the richer prov.type. See lib/party-scope.js.
function partySide(card) {
  const fromCode = partyLabel(partyScopeFromCode(cardCode(card)));
  if (fromCode) return fromCode;
  const scope = String(card?.party_scope || '').toUpperCase();
  if (scope && scope !== 'MUTUAL') {
    const lbl = partyLabel(scope);
    if (lbl) return lbl;
  }
  return 'Target / Company';
}

// Item 3 (r6): the approved threshold-phrasing rule, in ONE place so every
// config that renders a dollar-amount pill uses the exact same two labels
// instead of each growing its own wording ("Threshold: $X" on one config,
// "Below $X" on another, for what's semantically the same kind of figure).
// - A monetary EXCEPTION (an amount below which something is excused/
//   permitted) always reads "Below $X".
// - A monetary TRIGGER/RESTRICTION (an amount that activates an obligation
//   or restriction) reads "Trigger: $Y" -- and per the rule, a config should
//   only render this pill at all when there's no monetary-exception pill
//   already carrying the same figure (see ioc-exceptions.config.js's
//   dedupe: a restrictions-side pill exists only when there's no exception
//   pill, or the amounts differ).
function belowThresholdLabel(amount) {
  return amount ? `Below ${amount}` : null;
}
function triggerThresholdLabel(amount) {
  return amount ? `Trigger: ${amount}` : null;
}

// Item 7 (r6): table headers NEVER render with an ellipsis. The shared
// header form is "Main (qualifier)":
// - a clean parenthetical qualifier comes back as its own `qualifier` line
//   (ProvisionTable.jsx renders it as a second header line -- the "two-line
//   wrap where clean" branch);
// - a qualifier that itself arrives truncated ("..." / the Unicode
//   ellipsis) is OMITTED entirely rather than shown cut off;
// - a bare header that arrives ellipsized loses the trailing ellipsis (and
//   any dangling word fragment before it stays -- we can't reconstruct what
//   was cut, but we never SHOW the "...").
// Lives here (plain JS) so node:test can exercise it directly; every thead
// -- ProvisionTable.jsx's generic path and any config-local header row --
// must route header strings through this, never its own truncation.
const TRAILING_ELLIPSIS_RE = /\s*(?:\.{3}|…)\s*$/;
function headerLines(header) {
  if (typeof header !== 'string') return { main: header, qualifier: null };
  const raw = header.trim();
  const m = raw.match(/^(.*\S)\s*\(([^)]*)\)$/);
  if (m) {
    const qualifier = m[2].trim();
    return {
      main: m[1].replace(TRAILING_ELLIPSIS_RE, '').trim(),
      qualifier: qualifier && !/(?:\.{3}|…)/.test(qualifier) ? qualifier : null,
    };
  }
  return { main: raw.replace(TRAILING_ELLIPSIS_RE, '').trim(), qualifier: null };
}

export {
  allFeatures,
  belowThresholdLabel,
  buildSectionSubjectResolver,
  cardCode,
  cardFeatures,
  cardType,
  extractSectionCites,
  firstFeature,
  headerLines,
  labelOf,
  makeRow,
  makeRows,
  mappedRows,
  mappedRowsMulti,
  partySide,
  selectCards,
  splitForCell,
  stripProposedTitle,
  textOf,
  triggerThresholdLabel,
  valueText,
};
