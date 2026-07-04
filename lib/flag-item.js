// lib/flag-item.js — the "flags" array value shape: {concern, text} entries
// produced by the novelty/off-market escape valve (lib/parser-v2/extract.js's
// noveltyRule: any mechanic that doesn't fit the schema gets flagged rather
// than shoehorned or dropped). Distinct from a citable wrapper (no `value`
// key) and a tagged item (no `code` key) — the review UI needs its own
// discriminator so a flag object never falls through to String(obj) =>
// "[object Object]" (audit-2 item 2).
//
// Inlined (not importing lib/citable.js) so this module stays dependency-
// free: tests load it directly under `node --test` with no build step,
// matching lib/canonical-conditions.js's convention.
function isFlagItem(v) {
  return (
    v != null &&
    typeof v === 'object' &&
    !Array.isArray(v) &&
    typeof v.concern === 'string' &&
    v.concern.length > 0
  );
}

export { isFlagItem };
