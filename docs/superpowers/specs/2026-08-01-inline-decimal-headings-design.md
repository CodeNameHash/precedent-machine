# Sectionizer: inline decimal headings (Skechers gap)

**Date:** 2026-08-01. **Motivation:** the Skechers breadth run stopped
mechanically at section location
(`tests/fixtures/canonical-v2/skechers-first-live-run/section-location-scan.json`,
commit 62b5ed5): the document prints real decimal headings
("3.7 Company Capitalization.") as inline prose lines, the v1
`parseStructure` heading detector requires blank-line anchoring this
conversion never produces, and the tree's lettered-clause walker then
mints nodes that straddle the true 3.7/3.8 boundary. This is final-audit
finding B3 (sectionizer single point of failure) materialised. The
sectionizer is the highest-blast-radius component in the pipeline; this
design is deliberately additive and regression-pinned.

## Design

A new, self-contained pass INSIDE `deterministic-sectionizer.js` (the v1
`parseStructure` is frozen and untouched), running after the existing
tree build:

1. **Candidate scan.** Within each ARTICLE body, find line-START matches
   of a decimal heading shape: `^N.M Title.` where the line begins the
   candidate (offset 0 or preceded by `\n`), `N` equals the article's own
   number (3.x under ARTICLE III), `Title` is a short capitalised phrase
   ending with a period, and the match is NOT inside a sentence (the
   preceding character, if any, is a newline — cross-reference prose like
   "Sections 3.1(b)(i)" can never match because it is mid-line).
2. **Sequence gate.** Candidates in an article are accepted ONLY as a
   monotonically increasing run (3.1, 3.2, … possibly with gaps) with at
   least TWO members. A lone candidate is rejected — one plausible line
   is noise; a numbered sequence is a drafting convention. Rejections are
   typed into the sectionizer result, never silent.
3. **TOC corroboration signal (recorded, not required).** Where the
   document's table of contents contains a matching "Section N.M …"
   entry (Skechers does), the accepted heading records
   `toc_corroborated: true`. Absence does not reject — small agreements
   have no TOC.
4. **Node minting.** Each accepted heading mints a SECTION node with a
   heading-to-heading span (last section of the article closes at the
   article's end), `reference: "N.M"`, parent = the ARTICLE. The lettered
   SUBSECTION walk then runs WITHIN each minted section's span instead of
   across the article body, exactly as it runs within a `parseStructure`
   section today — same walker, narrower container.
5. **The regression pin — the load-bearing constraint.** On any document
   where the pass accepts zero headings, the output tree is BYTE-IDENTICAL
   to today's, node for node, id for id. QXO is the pinned regression
   fixture: its recorded tree (338 nodes, zero decimal headings — bare
   lettered subsections are not line-start `N.M` shapes) must reproduce
   exactly, asserted against the existing F28 fixtures and replay tests
   unchanged. Existing document identities never move.
6. **Downstream effects, all strictly widening:** Skechers' "3.7"
   citations become tree-CONSTRUCTIBLE (the stronger citation source);
   governed-scope selection can name "3.7"; the enumeration scan gains
   real heading anchors. Nothing that resolves today resolves differently.

## Acceptance

- Skechers fixture: the pass accepts the Article III run (3.1…3.x),
  mints a SECTION node whose span equals the scan artifact's true span
  `[121686, 126824)` for 3.7, and the lettered walker produces (a)/(b)…
  children nested inside it — no node straddles 3.7/3.8. (Fixture: the
  pinned source is re-fetchable by hash; the test can use a stored
  canonical-text excerpt covering Article III.)
- QXO: byte-identical tree; every existing sectionizer, replay and
  citation test green UNCHANGED.
- Cross-reference immunity: a synthetic document whose prose contains
  mid-line "Section 3.1(b)" references and NO line-start headings accepts
  zero candidates.
- Lone-candidate rejection typed and visible.
- Determinism: permuted/duplicate-run invariance as everywhere else.

## Out of scope

`parseStructure` (frozen v1), the converter, any identity change for any
already-processed document, and TOC-driven section discovery (signal
only, this slice).
