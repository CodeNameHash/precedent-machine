// r14 (Ben): compare mode renders ONE unified table per section — a single
// left label column plus one answer column per deal — instead of a full
// table copy per deal. This module is the pure row-matching/union logic
// (no React, no fetches) so it stays directly testable under node:test.
//
// Identity rule: a row is matched across deals by its config-assigned id
// when that id is stable (the hand-written slugs like
// 'structure-mechanics-marketing-period' or 'nosol-noshop-cease'); ids that
// embed a deal-specific token (a card UUID — reps rows are
// `${configId}-${card.id}` — or a long digit run) fall back to the row's
// normalized label ('Capitalization' matches 'Capitalization' across
// deals). Rows with neither a stable id nor a string label never match
// across deals (anon key) — they render in their own deal only.
//
// r16 ROW_FAMILY step (docs/PLAN.md P3, Ben decision 1 = option B):
// taxonomy splits put the SAME real-world clause under two different
// provision-subtype codes depending on the deal (e.g. one deal's payment
// agent covenant classifies REP-T-CONTRACTS, another's the same concept
// classifies REP-T-MATERIAL-CONTRACTS). Because each deal's row.label comes
// straight off that card's own short_title/defined_term (card-utils.js
// labelOf()), the two rows' labels rarely match verbatim, so the normal
// id/label fallback above renders TWO mutually one-sided rows for what is
// really one comparison. ROW_FAMILY_CODE_TO_KEY canonicalizes by the row's
// own underlying provision code (checked BEFORE the id/label fallback,
// since it's the strongest signal available) so both codes' rows collapse
// onto one shared key; ROW_FAMILY_LABEL_BY_KEY carries the surviving label
// for that canonical row (rowFamilyLabel(), consumed by CompareColumn.jsx's
// flatLabelNode() instead of picking one deal's own row.label at random).
// Each deal's ANSWER cell still renders from that deal's own row/card —
// only the shared LABEL is canonicalized. SEC-rep fold-ins (NOLIAB/
// CONTROLS folding into REP-T-SEC) are deliberately excluded — those are a
// feature-level fold, not a row-identity split.

const DEAL_SPECIFIC_ID_RE = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}|\d{5,}/;

const ROW_FAMILY_GROUPS = [
  { label: 'Material contracts', codes: ['REP-T-CONTRACTS', 'REP-T-MATERIAL-CONTRACTS'] },
  { label: 'Payment & exchange mechanics', codes: ['COV-PAYAGENT', 'CONSID-EXCHANGE'] },
  // v1 reclassification (2026-08-02, R1 — audit A-M5): REP-T-CONSENT is
  // retired; its de facto content (18/19 corpus cards) was governmental
  // approvals, so the union follows the successor code. The proposed
  // cross-party STOCKAPPROVAL+REP-B-VOTE union was WITHDRAWN by the audit —
  // occurrence-order pairing could pair a buyer vote rep against another
  // deal's target approval rep, and the rows may never co-list.
  // REP-T-STOCKAPPROVAL renders as its own row; any future cross-party
  // grouping is a Fable+Ben design item with party-aware pairing, not a
  // rename rider on this table.
  { label: 'No conflict; consents & approvals', codes: ['REP-T-GOVAPPROVAL', 'REP-T-NOCONFLICT'] },
  { label: 'Anti-corruption & sanctions', codes: ['REP-T-SANCTIONS', 'REP-T-ANTICORR'] },
  { label: 'Jurisdiction & jury waiver', codes: ['MISC-JURY', 'MISC-JURISD'] },
  { label: 'Stockholder meeting & proxy', codes: ['COV-PROXY', 'COV-MEETING'] },
];

const ROW_FAMILY_CODE_TO_KEY = new Map();
const ROW_FAMILY_LABEL_BY_KEY = new Map();
ROW_FAMILY_GROUPS.forEach(({ label, codes }, index) => {
  const key = `family:${index}`;
  ROW_FAMILY_LABEL_BY_KEY.set(key, label);
  codes.forEach((code) => ROW_FAMILY_CODE_TO_KEY.set(code, key));
});

// Reads the row's own underlying provision code off whichever field the
// producing config attached it under — `row.code` (material-contracts
// bucket rows), `row.card` (reps rows), or `row.sourceCard`/`row.source`
// (link-style covenant/consideration/misc rows) — mirroring the same
// `provision_subtype || canonical_code || provision_code || code` priority
// card-utils.js's cardCode() uses everywhere else in the review layer.
function rowFamilyCode(row) {
  if (!row || typeof row !== 'object') return null;
  const cards = [row.card, row.sourceCard, row.source];
  const candidates = [row.code];
  for (const card of cards) {
    if (card && typeof card === 'object') {
      candidates.push(card.provision_subtype, card.canonical_code, card.provision_code, card.code);
    }
  }
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim().toUpperCase();
  }
  return null;
}

function rowFamilyKey(row) {
  const code = rowFamilyCode(row);
  return (code && ROW_FAMILY_CODE_TO_KEY.get(code)) || null;
}

// The surviving display label for a ROW_FAMILY canonical key (e.g.
// 'family:0'), or null when `key` isn't a family key — used by
// CompareColumn.jsx to render the shared label instead of one deal's own
// row.label for these rows.
export function rowFamilyLabel(key) {
  return (typeof key === 'string' && ROW_FAMILY_LABEL_BY_KEY.get(key)) || null;
}

export function normalizeLabelKey(label) {
  if (typeof label !== 'string') return null;
  const cleaned = label.trim().toLowerCase().replace(/\s+/g, ' ');
  return cleaned || null;
}

// r18 item 1 (Ben, dfaa71fa vs 7dc3a05f IOC compare): the same real-world
// interim-operating covenant renders as two one-sided rows across deals
// because ioc-exceptions.config.js's negative-covenant row id embeds the
// section BAND (`ioc-neg-<band>-<code>` -- see that file's buildNegativeRow
// doc comment for why the band is in the id at all: distinct React keys for
// a two-party deck's same-code covenant under two different bands), and the
// band is a numbering accident (one deal's §5.2, another's §4.1), not part
// of the covenant's identity. The row's own canonical restriction CODE
// (`row.code`, threaded by buildNegativeRow/renderNegativeRow) is the
// durable cross-deal identity signal -- checked here, band dropped.
const IOC_NEGATIVE_ID_RE = /^ioc-neg-/;

function iocNegativeCodeKey(row) {
  if (!row || typeof row !== 'object') return null;
  if (typeof row.id !== 'string' || !IOC_NEGATIVE_ID_RE.test(row.id)) return null;
  const code = typeof row.code === 'string' && row.code.trim() ? row.code.trim().toUpperCase() : null;
  return code ? `ioc-neg-code:${code}` : null;
}

// r18 item 1: IOC affirmative-limb rows (`ioc-aff-<card.id>-<n>`) and
// "Other restrictions" fragment rows (`ioc-frag-<card.id>`) both embed a
// deal-specific card id, so the id/label fallback below never matches them
// across deals -- and both carry no taxonomy CODE at all (their titles come
// from a deterministic rubric applied to the limb's obligation text, or a
// section-ref/keyword-sniffed fragment name, never a `provision_subtype`).
// The one durable cross-deal signal for these rows is the resolved TITLE
// TEXT itself, which producers stamp onto `row.titleText` specifically for
// this purpose (a plain string, kept separate from `row.label`, which for
// these rows is a decorated React element carrying a hover-only raw code --
// see ioc-exceptions.config.js's covenantLabelNode). Any row from any
// config can opt into title-based matching this way, not just IOC's.
function titleTextKey(row) {
  if (!row || typeof row !== 'object') return null;
  const key = normalizeLabelKey(row.titleText);
  return key ? `title:${key}` : null;
}

export function rowIdentityKey(row) {
  if (!row || typeof row !== 'object') return null;
  const familyKey = rowFamilyKey(row);
  if (familyKey) return familyKey;
  const iocCodeKey = iocNegativeCodeKey(row);
  if (iocCodeKey) return iocCodeKey;
  const titleKey = titleTextKey(row);
  if (titleKey) return titleKey;
  const id = row.id !== null && row.id !== undefined ? String(row.id) : '';
  if (id && !DEAL_SPECIFIC_ID_RE.test(id)) return `id:${id}`;
  const label = normalizeLabelKey(row.label);
  if (label) return `label:${label}`;
  return id ? `id:${id}` : null;
}

// r18 item 2 (Ben): Definitions unify by normalized defined term
// (case/punctuation-insensitive -- "Merger Sub." / "MERGER SUB" / "merger
// sub" are the same defined term), alphabetically, NOT in primary-deal-first
// order (unlike unionRows above, a definitions list has no "primary deal
// order" that matters -- alphabetical is what the single-deal
// DefinitionsSection already does).
export function normalizeDefinedTerm(term) {
  if (typeof term !== 'string') return null;
  const cleaned = term.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned || null;
}

// [{ key, term, defs }] where defs[i] is definitionLists[i]'s matching
// definition object or null ("Not extracted for this deal" territory),
// sorted alphabetically by the surviving display term (the first list's
// own verbatim casing for that normalized term, so "Merger Sub" wins over
// a later list's "MERGER SUB").
export function unionDefinitions(definitionLists) {
  const lists = Array.isArray(definitionLists) ? definitionLists : [];
  const byKey = new Map();
  lists.forEach((defs, listIndex) => {
    (Array.isArray(defs) ? defs : []).forEach((def) => {
      const term = def && def.defined_term;
      const norm = normalizeDefinedTerm(term);
      if (!norm) return;
      const key = `term:${norm}`;
      let entry = byKey.get(key);
      if (!entry) {
        entry = { key, term: String(term).trim(), defs: new Array(lists.length).fill(null) };
        byKey.set(key, entry);
      }
      if (entry.defs[listIndex] === null) entry.defs[listIndex] = def;
    });
  });
  return [...byKey.values()].sort((a, b) => a.term.localeCompare(b.term));
}

// Union/ordering rule: rowLists[0] (the primary deal) contributes its rows
// first, in its own order; each subsequent list (compared deals, URL order)
// appends only its not-yet-seen rows, in that list's own order. Returns
// [{ key, rows }] where rows[i] is list i's matching row or null.
//
// Duplicate keys WITHIN one list (two rows sharing a label) stay distinct:
// the Nth occurrence in one list matches the Nth occurrence of the same key
// in another list (`key~N` internally), never collapsing real rows.
export function unionRows(rowLists, keyFn = rowIdentityKey) {
  const lists = Array.isArray(rowLists) ? rowLists : [];
  const order = [];
  const byKey = new Map();
  lists.forEach((rows, listIndex) => {
    const occurrences = new Map();
    (Array.isArray(rows) ? rows : []).forEach((row, rowIndex) => {
      let base = keyFn(row);
      if (!base) base = `anon:${listIndex}:${rowIndex}`;
      const n = occurrences.get(base) || 0;
      occurrences.set(base, n + 1);
      const key = n === 0 ? base : `${base}~${n}`;
      let entry = byKey.get(key);
      if (!entry) {
        entry = { key, rows: new Array(lists.length).fill(null) };
        byKey.set(key, entry);
        order.push(entry);
      }
      if (entry.rows[listIndex] === null) entry.rows[listIndex] = row;
    });
  });
  return order;
}

export function primaryGroupReviewId(groupEntry) {
  const groupId = groupEntry?.rows?.[0]?.id;
  return typeof groupId === 'string' && groupId.trim() ? groupId.trim() : null;
}
