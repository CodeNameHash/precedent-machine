# Span accounting — extraction that cannot silently lose text

Spec author: Fable, 2026-07-18. Covers tasks #12 (structured claims stay
structured) is NOT this spec; this is #13 (join keys + span accounting) —
the fix for the mid-provision-loss defect class. Ben's framing (verbatim
intent): "Article III is reps, §3.2 is the cap rep, §3.2(i) is a particular
type of cap rep — so that nothing can be dropped."

## The defect class (two live fixtures, both deterministic)

1. **Redfin §2.10 (Employees; Employee Benefits)** — parsed correctly,
   classified REP-T correctly, but extraction captures only part of the
   17k-char body; the disclosure-letter enumeration in the middle is
   dropped. Deal fails the coverage gate at 92% because of it.
2. **QXO §5.2(a)** — the tiered rep bring-down ((i) covenant compliance;
   (ii)(A) AoC-flat / (B) cap-de-minimis / (C) organization…) is dropped
   IN FULL by COND-B extraction across repeated runs, while (b) MAE and
   (c) certificate survive. No bringDownTiers reach the render.

Root cause in both: within a classified section, the LLM's output DEFINES
what sub-content exists. Nothing forces the union of emitted items to
account for the section's text, so an omitted sub-clause vanishes without
any error. (Levels 1–2 — article/section — are already deterministic and
loss-proof; this spec extends the guarantee one level down.)

## Design principle

LLM proposes; spans dispose. Deterministic sub-clause segmentation
underneath the generative layer, span claims on every emitted item, and a
per-section residual check that FAILS LOUDLY (like the CONSID-EQUITY
quote-fidelity invariant, which has caught three real bugs this week).

## Part 1 — deterministic sub-clause segmentation (lib/parser-v2/subclauses.js, new)

`segmentSubClauses(sectionText)` → ordered list of
`{ marker, depth, start, end, text }` covering the section body:
- Markers: `(a)…(z)`, `(aa)…`, `(i)(ii)…` roman, `(A)(B)…`, `(1)(2)…`,
  nested to depth 3. Chapeau text before the first marker is its own span
  (`marker: null`). Every char of the section belongs to exactly ONE
  leaf span (parents contain children; leaves partition).
- Pure functions, no LLM. Reuse the marker heuristics already proven in
  consideration-equity.js (priorMarkerStart / nextMarkerStart) rather than
  inventing new ones; lift them into this module and re-export.
- Fixture tests: QXO §5.2 (must yield (a)(i), (a)(ii)(A–D), (b), (c)),
  Redfin §2.10 (must yield (a)–(f) or the section's actual shape — pin
  from the real stored text), plus a markerless-prose section (single
  span) and a hard-wrapped-marker case.

## Part 2 — span claims on extraction output

For strategy A (IOC/COND) and strategy C (REP) provisions — the two
families where the fixtures live — each emitted provision/feature-item
gains `claimedSpans: [{start, end}]` in section-relative offsets:
- Post-extraction, deterministic: locate each emitted item's quote/text in
  the section (normalizeForMatch space, existing locate helpers) and
  record the covering sub-clause span(s) from Part 1. NO prompt changes in
  this phase — location is derived, not model-asserted.
- An item whose text cannot be located anywhere in the section is flagged
  `spanUnlocated: true` (this is the hallucination surface — feeds the
  same QA counter as quote verification).

## Part 3 — the residual invariant (per-section, in validate.js)

After extraction of a section's provisions:
`residual = leaf spans NOT covered by any item's claimedSpans`, ignoring
(a) spans shorter than 200 normalized chars, (b) chapeau spans whose text
is pure preamble boilerplate (reuse the coverage benign-classifier
patterns). If `residualChars / sectionChars > 0.25` OR any single leaf
span > 1,500 chars is unclaimed → the section is flagged
`EXTRACTION_INCOMPLETE` with the dropped spans' markers + previews.

Rollout gates (in order, each behind a flag until proven):
1. REPORT-ONLY corpus baseline: run over all 40 deals' stored snapshots,
   write reports/span-residual-baseline.json. Expect Redfin §2.10 and QXO
   §5.2 flagged; investigate anything else large before enforcement.
2. Enforcement in ingest: EXTRACTION_INCOMPLETE triggers ONE targeted
   re-extract of just the flagged section with the dropped sub-clauses
   quoted in the prompt ("your extraction omitted (a)(ii); extract it").
   Second failure → hard-fail the ingest (checkpoints make retry cheap).
3. QA gate: `sections flagged incomplete == 0` joins ingest-qa; coverage
   gate tightens 95 → 98 once the corpus baseline is clean.

## Part 4 — join keys (the cross-wiring half)

Every per-item list emitted by extraction carries an explicit join key:
- Equity: instrumentType (already canonical — done).
- COND bring-down tiers: the sub-clause marker path (`"a.ii.B"`) from
  Part 1, stamped by the same locate step as Part 2.
- IOC limbs, NOSOL prohibited-acts, TERMF triggers: marker path likewise.
Downstream joins (claims-adapter, table configs) match on the key and
TREAT A MISSING KEY AS AN ERROR ROW (rendered with a visible "unlinked"
badge in edit mode), never positional fallback. Skechers' pairListByMention
stays as the display-name resolver but no longer decides identity.

## Sequencing & delegation

Parts 1+2 are producible-on-cheap against this spec (pure functions +
pinned fixtures; no DB, no prompts). Part 3 report-only likewise. Part 3
enforcement + Part 4 downstream-join changes need Fable review against the
two fixtures rendering correctly (QXO bring-down table populated; Redfin
coverage ≥ 98). Nothing here changes the DB schema; #12 (structured claim
storage) layers on top later and is deliberately out of scope.
