/* ─────────────────────────────────────────────────────────────────────────
   lib/parser-v2/reapply-corrections.js — human edits survive re-extraction.
   ───────────────────────────────────────────────────────────────────────────
   Re-ingest deletes and re-inserts provisions, which used to silently discard
   every edit made through the review UI. Corrections were already LOGGED
   (corrections table: before/after snapshots per PATCH) — this module makes
   them durable overlays that get RE-APPLIED after every store:

     1. compute the user's delta (only the fields they changed; for features,
        only the top-level keys they changed),
     2. match each correction to the freshly-extracted provision it belongs to
        (its old provision_id is gone) — by the BEFORE category (what the
        extractor reproduces), falling back to AFTER, plus token-overlap
        similarity on the clause text,
     3. apply the delta onto the fresh provision — user judgment wins on the
        fields they touched, the fresh extraction wins everywhere else.

   Pure planning core (unit-tested) + one thin DB wrapper. CommonJS, like the
   rest of parser-v2.
   ───────────────────────────────────────────────────────────────────────── */

const TRACKED_SCALARS = ['type', 'category', 'full_text', 'ai_favorability'];

// DATA-2 hardening. Three independent guards, each targeting a distinct
// misgraft mode a bare 0.3 Jaccard-with-category floor let through:
//
//  1. MIN_SIM_WITH_CATEGORY raised 0.3 -> 0.45. A category match still
//     carries most of the signal (so this stays well below the text-only
//     floor), but 0.3 was low enough that two DISTINCT sibling provisions in
//     the same category with only loose token overlap (e.g. two termination
//     fee provisions covering different triggers) could both clear it,
//     leaving the choice to whichever happened to score fractionally higher.
//     0.45 requires close to half the union of tokens to be shared.
//     MIN_SIM_TEXT_ONLY (0.6) is unchanged -- a category mismatch already
//     demands strong text support, and the review didn't flag that leg.
//  2. MIN_MARGIN (0.15): the best-scoring candidate must beat the runner-up
//     by this much or the match is REJECTED (returned as unmatched, the
//     established safe outcome -- see the "reports unmatched, never drops"
//     contract on planReapplication/reapplyCorrections). Without a margin,
//     a near-tie between two sibling provisions picked whichever scored
//     epsilon higher, which is exactly how a correction can graft onto the
//     wrong sibling. 0.15 is roughly half of the gap between the two
//     similarity floors (0.45 vs 0.6), chosen so a genuinely dominant match
//     (the common case -- one provision is a clear textual descendant of
//     the correction's `before` snapshot) clears it easily, while two
//     structurally similar siblings scored within noise of each other do
//     not.
//  3. Quote/fragment re-check: when `before.full_text` is present, the
//     chosen provision's `full_text` must still contain some ~40-normalized-
//     character contiguous window of it. Jaccard is bag-of-words and blind
//     to order, so two provisions that reuse the same boilerplate vocabulary
//     in a different arrangement (e.g. a paraphrased/reordered fee clause
//     with a different dollar figure) can clear both the similarity floor
//     and the margin while sharing no real contiguous text with the
//     correction's anchor. This is the last-line check against exactly that.
const MIN_SIM_WITH_CATEGORY = 0.45;
const MIN_SIM_TEXT_ONLY = 0.6;
const MIN_MARGIN = 0.15;
const MIN_FRAGMENT_LEN = 40;

function tokens(s) {
  return new Set(
    String(s || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2),
  );
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  return inter / (a.size + b.size - inter);
}

function normalizeForFragment(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

// Does some contiguous, order-preserving chunk of `beforeFullText` still
// appear in `provisionFullText`? Guards against Jaccard's blindness to word
// order/position (see guard 3 above). Texts shorter than MIN_FRAGMENT_LEN are
// checked for exact containment (there's no window to slide). Absent
// `before.full_text` entirely, the check is skipped by the caller.
function fragmentStillAppears(beforeFullText, provisionFullText) {
  const before = normalizeForFragment(beforeFullText);
  const target = normalizeForFragment(provisionFullText);
  if (!before) return true;
  if (!target) return false;
  if (before.length <= MIN_FRAGMENT_LEN) return target.includes(before);
  const step = 20;
  for (let start = 0; start + MIN_FRAGMENT_LEN <= before.length; start += step) {
    if (target.includes(before.slice(start, start + MIN_FRAGMENT_LEN))) return true;
  }
  // Cover the tail window the step size may have skipped past.
  return target.includes(before.slice(before.length - MIN_FRAGMENT_LEN));
}

/**
 * The fields the user actually changed, as an update object.
 * Features are diffed per top-level key: changed/added keys carry the user's
 * value; deleted keys are listed for removal.
 */
function computeUserDelta(before, after) {
  const delta = { set: {}, featureSet: {}, featureDelete: [] };
  for (const f of TRACKED_SCALARS) {
    const b = before ? before[f] : undefined;
    const a = after ? after[f] : undefined;
    const norm = (v) => (v === null || v === undefined ? '' : v);
    if (norm(b) !== norm(a)) delta.set[f] = a ?? null;
  }
  const bf = (before && before.features) || {};
  const af = (after && after.features) || {};
  for (const k of Object.keys(af)) {
    if (JSON.stringify(bf[k]) !== JSON.stringify(af[k])) delta.featureSet[k] = af[k];
  }
  for (const k of Object.keys(bf)) {
    if (!(k in af)) delta.featureDelete.push(k);
  }
  delta.empty = Object.keys(delta.set).length === 0
    && Object.keys(delta.featureSet).length === 0
    && delta.featureDelete.length === 0;
  return delta;
}

/**
 * Find the freshly-extracted provision a correction belongs to.
 * `provisions`: DB rows { id, type, category, full_text, ai_metadata }.
 * Returns { provision, score } or null -- null means "can't confidently
 * place this correction", which callers must treat as unmatched (preserved
 * and surfaced), never as license to graft onto the top-scoring candidate
 * regardless of confidence.
 */
function matchCorrectionToProvision(correction, provisions) {
  const before = correction.before || {};
  const after = correction.after || {};
  const beforeToks = tokens(before.full_text);

  const scored = [];
  for (const p of provisions) {
    const sim = jaccard(beforeToks, tokens(p.full_text));
    const categoryMatch = p.category && (p.category === before.category || p.category === after.category);
    const eligible = categoryMatch ? sim >= MIN_SIM_WITH_CATEGORY : sim >= MIN_SIM_TEXT_ONLY;
    if (!eligible) continue;
    // Guard 3: the correction's original text must still be recognizably
    // present in the candidate, not just token-overlapping with it.
    if (before.full_text && !fragmentStillAppears(before.full_text, p.full_text)) continue;
    const score = sim + (categoryMatch ? 1 : 0);
    scored.push({ provision: p, score });
  }
  if (!scored.length) return null;

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  // Guard 2: an unambiguous winner must beat the runner-up by MIN_MARGIN.
  // A near-tie among structurally similar siblings is exactly the ambiguous
  // case that used to resolve to "whichever scored epsilon higher" --
  // reject it as unmatched instead of guessing.
  if (scored.length > 1 && (best.score - scored[1].score) < MIN_MARGIN) return null;
  return best;
}

/**
 * Plan re-application of `corrections` (chronological order) onto fresh
 * `provisions`. Multiple corrections matching one provision merge in order —
 * the latest edit to a field wins, mirroring how they were originally made.
 * Returns { updates: Map<provisionId, {set, featureSet, featureDelete, correctionIds}>, unmatched }.
 */
function planReapplication(corrections, provisions) {
  const updates = new Map();
  const unmatched = [];

  for (const c of corrections) {
    const delta = computeUserDelta(c.before, c.after);
    if (delta.empty) continue;
    const match = matchCorrectionToProvision(c, provisions);
    if (!match) {
      unmatched.push({ correction_id: c.id, correction_type: c.correction_type, category: (c.before || {}).category || null });
      continue;
    }
    const id = match.provision.id;
    if (!updates.has(id)) updates.set(id, { set: {}, featureSet: {}, featureDelete: new Set(), correctionIds: [] });
    const u = updates.get(id);
    Object.assign(u.set, delta.set);
    Object.assign(u.featureSet, delta.featureSet);
    for (const k of delta.featureDelete) u.featureDelete.add(k);
    for (const k of Object.keys(delta.featureSet)) u.featureDelete.delete(k);
    u.correctionIds.push(c.id);
  }
  return { updates, unmatched };
}

/**
 * Fetch, plan, and apply corrections for a deal's type group after a store.
 * Best-effort: individual apply failures are collected, never thrown.
 * Returns { applied, unmatched, errors }.
 */
async function reapplyCorrections({ dealId, typeGroup, sb }) {
  const { data: corrections, error: cErr } = await sb
    .from('corrections')
    .select('id, correction_type, before, after, created_at')
    .eq('deal_id', dealId)
    .order('created_at', { ascending: true });
  if (cErr) return { applied: 0, unmatched: [], errors: [`corrections fetch: ${cErr.message}`] };

  const groupSet = new Set(typeGroup);
  const relevant = (corrections || []).filter((c) => {
    const t = (c.before && c.before.type) || (c.after && c.after.type) || null;
    return t && groupSet.has(t);
  });
  if (!relevant.length) return { applied: 0, unmatched: [], errors: [] };

  const { data: provisions, error: pErr } = await sb
    .from('provisions')
    .select('id, type, category, full_text, ai_metadata')
    .eq('deal_id', dealId)
    .in('type', typeGroup);
  if (pErr) return { applied: 0, unmatched: [], errors: [`provisions fetch: ${pErr.message}`] };

  const { updates, unmatched } = planReapplication(relevant, provisions || []);
  const errors = [];
  let applied = 0;

  for (const [id, u] of updates) {
    const row = (provisions || []).find((p) => p.id === id);
    const meta = (row && row.ai_metadata) || {};
    const features = { ...(meta.features || {}), ...u.featureSet };
    for (const k of u.featureDelete) delete features[k];
    const payload = {
      ...u.set,
      ai_metadata: { ...meta, features, reapplied_corrections: u.correctionIds },
    };
    const { error } = await sb.from('provisions').update(payload).eq('id', id);
    if (error) errors.push(`apply to ${id}: ${error.message}`);
    else applied += 1;
  }

  return { applied, unmatched, errors };
}

module.exports = {
  computeUserDelta,
  matchCorrectionToProvision,
  planReapplication,
  reapplyCorrections,
};
