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

const DEAL_SPECIFIC_ID_RE = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}|\d{5,}/;

export function normalizeLabelKey(label) {
  if (typeof label !== 'string') return null;
  const cleaned = label.trim().toLowerCase().replace(/\s+/g, ' ');
  return cleaned || null;
}

export function rowIdentityKey(row) {
  if (!row || typeof row !== 'object') return null;
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
