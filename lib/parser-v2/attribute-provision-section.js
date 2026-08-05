/* ─────────────────────────────────────────────────────────────────────────
   lib/parser-v2/attribute-provision-section.js — content-based provision ->
   current-section attribution, resilient to classified_sections snapshot
   drift.

   Span accounting spec (docs/archive/handoffs/SPAN-ACCOUNTING-SPEC-2026-07-18.md)
   Part 3's rollout gate 1 (scripts/span-residual-baseline.js) reconstructs,
   RETROACTIVELY, which classified section each of a deal's ALREADY-STORED
   provisions belongs to — because it runs against stored snapshots, not a
   live extraction, there is no single run in which "the sections" and "the
   provisions" are guaranteed to agree on where anything starts.

   THE DRIFT: a provision's `ai_metadata.startChar` is stamped once, at
   whatever moment that provision was last (re-)extracted. `deals.metadata.
   classified_sections` is a single snapshot that gets OVERWRITTEN wholesale
   by the next classification run for that deal — for any reason, including
   ones unrelated to this provision (a classifier fix, a re-ingest of a
   different type group that still re-runs classify first). When that
   happens, section boundaries can shift by any number of characters, and
   every provision extracted under the OLD boundaries now carries a
   startChar that may fall in the wrong section, or no section at all, under
   the NEW snapshot. This is an attribution problem, not an extraction
   problem: the provision's text was never lost, only the pointer to "which
   section is it in" went stale.

   A naive fix — reject provisions whose startChar doesn't land inside any
   current section — is what scripts/span-residual-baseline.js did before
   this module existed, and it manufactures false EXTRACTION_INCOMPLETE
   flags: 470 of the 952 sections flagged in the 2026-07-18 baseline run
   (reports/span-residual-baseline.json) have ZERO provisions attributed to
   them for exactly this reason — not because extraction dropped anything,
   but because the retroactive attribution step couldn't find them. Stamping
   that as "unlocated" / "fabricated" would be wrong on 470 sections where
   nothing was fabricated (docs/codex-program/ROADMAP.md, P5).

   THE FIX: attribute by CONTENT, not by stale position. A provision's own
   `full_text` is searched for inside each candidate section's CURRENT text
   (the same three-pass locator span-claims.js's locateInSection already
   uses — exact substring, then whitespace-tolerant, then head-match for a
   truncated quote) and the provision is attributed to whichever section
   actually contains it, regardless of what its stored startChar says. This
   survives section boundaries moving by any amount, because it never reads
   a position — only content.

   Tie-break, when the SAME text is found in more than one candidate section
   (short boilerplate repeated verbatim is the realistic case): prefer the
   section whose startChar is closest to the provision's own stale
   startChar. The stale offset is still useful information — just not
   authoritative on its own — so it is used only to break a genuine content
   tie, never as the primary signal.

   Fallback, when content-based location fails everywhere (the provision's
   stored full_text was itself rewritten/re-normalized after extraction and
   is no longer even a fuzzy substring of any current section's text): fall
   back to the legacy numeric-containment check. This is the ORIGINAL
   mechanism and keeps today's best-effort behavior for the residual case
   content-matching cannot help with, rather than silently dropping the
   provision from every section's count.

   Deterministic, no LLM — same character as span-claims.js, which this
   module is built directly on top of (locateInSection).
   ───────────────────────────────────────────────────────────────────────── */

const { locateInSection } = require('./span-claims');

/**
 * attributeProvisionToSection(sections, provisionText, staleStartChar) →
 *   the section object (from `sections`) this provision's text belongs to
 *   under the CURRENT snapshot, or `null` if none can be determined.
 *
 * @param {Array<{startChar: number, text: string}>} sections — a deal's
 *   CURRENT classified_sections (any order; not required to be sorted).
 * @param {string} provisionText — the provision's own full_text.
 * @param {number|null} [staleStartChar] — the provision's stored
 *   ai_metadata.startChar, which may be stale relative to `sections`. Used
 *   ONLY as a tie-break among multiple content matches, and as the
 *   fallback mechanism when content-matching finds nothing. Pass `null`/
 *   `undefined` when the provision carries no stored startChar at all.
 */
function attributeProvisionToSection(sections, provisionText, staleStartChar) {
  const list = Array.isArray(sections) ? sections.filter((s) => s && Number.isFinite(s.startChar)) : [];
  const text = String(provisionText || '');
  const hasStale = Number.isFinite(staleStartChar);

  // PRIMARY: content-based. A provision can straddle exactly one section by
  // construction (sections partition the document), so the section whose
  // OWN text contains this provision's text is the right answer regardless
  // of numeric drift.
  const contentMatches = list.filter((sec) => locateInSection(sec.text || '', text) !== null);
  if (contentMatches.length === 1) return contentMatches[0];
  if (contentMatches.length > 1) {
    if (hasStale) {
      // Break the tie with the stale offset as a weak prior: whichever
      // candidate's startChar is numerically closest to where this
      // provision used to think it was is far more likely to be the same
      // section that merely shifted, than a coincidental duplicate phrase
      // elsewhere in the document.
      return contentMatches.slice().sort(
        (a, b) => Math.abs(a.startChar - staleStartChar) - Math.abs(b.startChar - staleStartChar),
      )[0];
    }
    // No stale offset to break the tie with — earliest in document order is
    // the least-arbitrary deterministic choice.
    return contentMatches.slice().sort((a, b) => a.startChar - b.startChar)[0];
  }

  // FALLBACK: legacy numeric containment — the ORIGINAL mechanism, kept for
  // the case content-matching cannot help with at all (stored full_text no
  // longer resembles anything in the current snapshot). May itself be
  // stale (that is the failure mode this module exists to reduce), but a
  // best-effort answer here is strictly better than silently dropping the
  // provision from every section's count.
  if (!hasStale) return null;
  let containing = null;
  for (const sec of list) {
    if (sec.startChar > staleStartChar) continue;
    const secEnd = sec.startChar + (sec.text || '').length;
    if (staleStartChar < secEnd && (!containing || sec.startChar > containing.startChar)) {
      containing = sec;
    }
  }
  return containing;
}

/**
 * attributeProvisionsToSections(sections, provisions, opts) → Map(section.
 * startChar -> [provision, ...]), the same shape scripts/span-residual-
 * baseline.js's groupProvisionsBySection returned before this module
 * existed, generalized to any provision shape via `opts.textOf` /
 * `opts.staleStartCharOf` accessors (default to the shape provisions.select
 * ('type, full_text, ai_metadata') returns).
 *
 * Every section in `sections` gets a Map entry (possibly empty) so callers
 * can iterate "all in-scope sections" without a separate has-key check.
 */
function attributeProvisionsToSections(sections, provisions, opts = {}) {
  const textOf = opts.textOf || ((p) => p && p.full_text);
  const staleStartCharOf = opts.staleStartCharOf || ((p) => (
    p && p.ai_metadata && Number.isFinite(p.ai_metadata.startChar) ? p.ai_metadata.startChar : null
  ));

  const list = Array.isArray(sections) ? sections.filter((s) => s && Number.isFinite(s.startChar)) : [];
  const bySection = new Map();
  for (const sec of list) bySection.set(sec.startChar, []);

  for (const prov of (provisions || [])) {
    const text = textOf(prov);
    if (!text) continue;
    const staleStartChar = staleStartCharOf(prov);
    const section = attributeProvisionToSection(list, text, staleStartChar);
    if (section) bySection.get(section.startChar).push(prov);
  }
  return bySection;
}

module.exports = {
  attributeProvisionToSection,
  attributeProvisionsToSections,
};
