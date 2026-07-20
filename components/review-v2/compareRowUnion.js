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
  { label: 'No conflict; consents & approvals', codes: ['REP-T-CONSENT', 'REP-T-NOCONFLICT'] },
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

export function rowIdentityKey(row) {
  if (!row || typeof row !== 'object') return null;
  const familyKey = rowFamilyKey(row);
  if (familyKey) return familyKey;
  const id = row.id !== null && row.id !== undefined ? String(row.id) : '';
  if (id && !DEAL_SPECIFIC_ID_RE.test(id)) return `id:${id}`;
  const label = normalizeLabelKey(row.label);
  if (label) return `label:${label}`;
  return id ? `id:${id}` : null;
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
