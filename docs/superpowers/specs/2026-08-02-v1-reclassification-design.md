# v1 reclassification — R1/R2/R3 subtype splits

**Date:** 2026-08-02. **Status:** DRAFT — pending adversarial audit
(D1 standing practice). **Authority:** Ben's confirmed rulings R1-R3
(`docs/acks/FAMILY-MAPPING-RULINGS-2026-08-02.md`).

## What splits, and by which mechanism (the scout's central finding)

The three rulings hit DIFFERENT classification mechanisms and need
different safety treatment:

- **R1 (`REP-T-CONSENT` → `REP-T-STOCKAPPROVAL` + `REP-T-GOVAPPROVAL`)
  and R2 (`REP-T-REGSTATUS` → `REP-T-40ACT` / `REP-T-ADVISERSACT` /
  `REP-T-INSREG` / `REP-T-CFIUS`) are AI-classification-only today** —
  no deterministic rule ever stamps them; they exist solely as CODES
  entries feeding the classify prompt. The split is: new CODES
  entries, retire the old two from the prompt's vocabulary, and
  deterministic title rules ADDED where titles are regular enough to
  warrant them (pinned below).
- **R3 (`REP-B-ANTIRELIANCE`/`REP-B-NOREP`/`REP-T-NOREP` → the
  four-element family) IS regex-classified** via
  `SUBCODE_REFINEMENT_RULES` (classify.js:324-333) — squarely inside
  the CLAUDE.md safety-check rule's blast radius.

## 1. CODES registry (`lib/rubric.js`)

Ten new entries (exact names per the ruling ack). Pinned decisions:

- **R3 party mirroring:** element codes exist in BOTH prefixes
  (`REP-B-NOOTHERREPS`… and `REP-T-NOOTHERREPS`…) because
  `store-cards.js` derives party scope from the code prefix
  (`partyScopeFromCode`) — a shared prefix-less family would break
  party attribution. Eight R3 codes total, two R1, four R2 → 14 new
  CODES entries; the five retired codes (`REP-T-CONSENT`,
  `REP-T-REGSTATUS`, `REP-B-ANTIRELIANCE`, `REP-B-NOREP`,
  `REP-T-NOREP`) stay REGISTERED but marked
  `retired: '2026-08-02', superseded_by: [...]` — never deleted
  (historic rows and fixtures reference them; the classify prompt
  excludes retired codes from `buildTypeReference`).
- Stale `industries: ['energy']` metadata corrected on the successor
  entries (CONSENT/REGSTATUS were mislabeled; the corpus shows
  footwear and REIT deals).
- **FEATURES schemas:** R3's element codes reuse the existing shared
  Abry-style schema block verbatim (copy under each new code — the
  registered pattern), EXCEPT `*-INDEPINVEST`, which needs ONE new
  field `independentInvestigationAcknowledged` added to that shared
  block (no existing field represents it; adding a field to the
  shared block also lands on MISC per the existing registration
  pattern). R1/R2 codes take per-code minimal schemas: R1
  `STOCKAPPROVAL` {voteStandard, shareClassesEntitled}; R1
  `GOVAPPROVAL` {regimesCited[]}; R2 codes {registrationRequired
  (tri-state), statuteCited} — deliberately thin; growth is a later
  adjudication, not an implementer guess.

## 2. Classify rules (`lib/parser-v2/classify.js`)

- **R3:** rewrite the four SUBCODE_REFINEMENT_RULES entries. Title
  routing alone CANNOT distinguish the four elements (titles like
  "Exclusivity of Representations and Warranties" cover compound
  sections). Pinned design: the title rules route to a NEW
  two-stage refinement — title match identifies the anti-reliance
  SECTION as before, then a deterministic ELEMENT SCAN over the
  section body (the corpus-evidence patterns: no-other-reps
  disclaimer / non-reliance acknowledgment / independent-
  investigation acknowledgment / fraud carve-out, each with the
  phrase classes from the 2026-08-02 investigation) stamps ONE CARD
  PER ELEMENT PRESENT. A section containing three elements yields
  three cards (the card model's instance-id hashes over
  (deal, sectionPath, text) — element cards must therefore carry
  element-scoped text spans, not the whole section, or they collide;
  the scan emits per-element spans). Elements the scan cannot
  confidently bound route the WHOLE section to a single
  `REP-B-NOOTHERREPS`-family card with a typed
  `ELEMENT_SCAN_UNSPLIT` flag in ai_metadata — fail toward
  under-splitting, never guess spans.
- **R1/R2:** new deterministic title rules ONLY where the corpus
  shows regular titles: "Requisite Stockholder Approval" →
  STOCKAPPROVAL; "Requisite Governmental Approvals" / "Governmental
  Authorization[s]" / "Government Approvals" → GOVAPPROVAL;
  "Investment Company Act" → 40ACT. Everything else stays
  AI-classified against the new CODES vocabulary (the prompt sees the
  new labels/descriptions; the old codes are excluded as retired).

## 3. Safety check (the CLAUDE.md rule, mechanized)

Extend the `safety-check-nosol-rule.js` pattern: a new
`scripts/safety-check-reclass-rules.js` that
1. loads pre-change `tryDeterministic`/`refineSubCode` from
   `git show HEAD:` and diffs against the new rules over EVERY deal's
   stored `classified_sections` snapshot (read-only);
2. hard-pins the EXPECTED flip set — exactly the cards the corpus
   investigation enumerated (19 CONSENT, 10 REGSTATUS, 44
   ANTIRELIANCE/NOREP family cards, by deal + section_ref) plus the
   known misclassifications exiting to backlog (Bonds df393645
   §3.22, Foreign Matters ce061fd0 §3.26 — these must flip to
   NOTHING deterministic, i.e. fall back to AI/open review, and the
   script asserts they do NOT silently land in a new bucket);
3. any flip outside the pinned set → exit 1, STOP before writes.
For the AI-only splits the script cannot diff regexes; instead the
apply procedure (section 4) hand-reviews 100% of the two small
populations — 29 cards total — against the ruling doc's per-card
classifications, recorded in the slice's dated handoff.

## 4. Apply procedure (per deal, the reprocess.js reality)

`--classify-only --apply` rewrites the snapshot; `--types REP-T
--apply` (and `REP-B`/`MISC` where R3 cards live under
MISC_BOILERPLATE) re-extracts the parent type. Scout-verified
mechanics honored: card `provision_instance_id`/`region_hash` are
text-derived and survive; the upsert updates `provision_subtype` in
place; claims anchored via excerpt_id survive. Order: the three
comparator-fixture deals FIRST (TopBuild, Skechers, Modiv — they are
the ruling doc's own ground-truth examples), hand-verified, then the
corpus. QA gates are silent on subtype splits (family-level
counters), so the verification burden is explicitly the safety
check + the 29-card hand review + the pinned flip set — stated so
nobody mistakes green QA for validation.

## 5. Reference-site updates (scout's break inventory, all in-slice)

- `no-other-reps-fraud.config.js` ABRY_CODES + the layout-slot
  inventory selector: extended with the eight R3 codes (old codes
  retained — historic rows).
- `compareRowUnion.js`: `REP-T-CONSENT`+`NOCONFLICT` union becomes
  `GOVAPPROVAL`+`NOCONFLICT`; NEW union `STOCKAPPROVAL`+`REP-B-VOTE`
  ("Votes & approvals required") per the ruling's own mirror
  rationale; `compare-row-union.test.js` updated.
- `metsfb2-extraction-batch2.test.js` refineSubCode assertions and
  `abry.test.js`/`provision-table-configs.test.js` fixture literals:
  updated to the new codes (old-code variants kept as
  retired-code regression cases where they assert historic behavior).
- Generated artifacts (`lib/schema/features*.js`,
  `lib/query/serving-registry-v1.json`): regenerated by their
  generator scripts, never hand-edited (locate the generator in the
  build step; if none exists, that is a typed finding for the audit,
  not a silent hand edit).
- v1v2 FAMILY_MAPPING_TABLE: `REP-T-NOREP`/`REP-B-NOREP` rows get
  `superseded_by` annotations and the EIGHT R3 identity rows join the
  table IN THE SAME SLICE as the DB reclassification lands (the
  ruling's "only after cards carry them" — this slice is exactly
  when they start carrying them); the three comparator snapshots are
  RE-EXPORTED post-reclassification (new snapshot ids, hash-stable)
  so fixtures and reality never desync.
- `canonicalize-duplicate-codes.js` stale comment refreshed.

## Acceptance

1. Safety-check script green with the pinned flip set; committed as
   the slice's review artifact alongside the 29-card hand review.
2. Element-scan unit tests over the investigation's quoted texts:
   compound Skechers §4.17 yields NOOTHERREPS + NONRELIANCE cards
   with disjoint spans; 0d38cc1f §4.12 yields INDEPINVEST;
   885edae5 §9.07 yields FRAUDCARVEOUT; an unboundable compound
   yields the typed unsplit flag.
3. Full suite green including every updated pinned test; build
   green; forbidden-patterns + phase allowlist.
4. Post-apply DB assertions (read-only): zero cards carry the five
   retired codes in the three fixture deals; corpus counts match the
   pinned expectations; snapshots re-exported and byte-stable.

## Out of scope

FAMILY value-mapping (Tier 2); SANCTIONS/ANTICORR disambiguation and
the four [PROPOSED] null-subtype cards (backlogged, listed in the
ack); any classify change beyond the three rulings; live re-ingest
(`reprocess.js` per-type refresh only).
