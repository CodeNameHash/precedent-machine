# v1 reclassification — R1/R2/R3 subtype splits

**Date:** 2026-08-02. **Status:** AUDIT-AMENDED (3 critical, 5 material folded; verdict was
AMEND). **Authority:** Ben's confirmed rulings R1-R3
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

Fourteen new entries (exact names per the ruling ack: 2 R1 + 4 R2 + 8 R3 mirrored). Pinned decisions:

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

- **R3 (RELOCATED per audit A-C1 — the classify layer cannot emit
  multiple cards per section):** classify keeps stamping ONE
  family-level code per section via the existing
  SUBCODE_REFINEMENT_RULES (snapshot schema carries one code slot);
  the ELEMENT SPLIT happens in the EXTRACT phase as a deterministic
  multi-provision emitter for the anti-reliance family (the Strategy-B
  precedent, extract.js ~136: one provisions row per element with
  element-scoped full_text/spans — card identity hashes over text, so
  element rows mint distinct cards; the card backfill's replaceDeal
  orphan-delete removes the old whole-section card). Title routing
  alone CANNOT distinguish the four elements (titles like
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
  confidently bound route the WHOLE section to a single card carrying
  `needs_review: true` (a field cards actually have — audit A-M2;
  ai_metadata does not reach cards), coded NOOTHERREPS ONLY when the
  no-other-reps phrase class itself matched despite unboundable
  spans; otherwise the family-level legacy code with needs_review —
  never a specific element the scan did not establish. Fail toward
  review, never toward a plausible-but-unproven element.
- **R1/R2 (mechanism pinned per audit A-M3):** SUBCODE_REFINEMENT_RULES
  entries with `whenType: 'REP-T'` (the NOREP precedent at
  classify.js:333) — NOT DETERMINISTIC_RULES, which never fire inside
  strong-typed REP articles without overrideArticle and would be
  silent no-ops. Rules ONLY where the corpus
  shows regular titles: "Requisite Stockholder Approval" →
  STOCKAPPROVAL; "Requisite Governmental Approvals" / "Governmental
  Authorization[s]" / "Government Approvals" → GOVAPPROVAL;
  "Investment Company Act" → 40ACT. Everything else stays
  AI-classified against the new CODES vocabulary (the prompt sees the
  new labels/descriptions; the old codes are excluded as retired).

### Retired-code enforcement (audit A-C2 — the real emission layer)

Subtype codes are emitted by EXTRACT, not classify. Enforcement set:
`retired:` filtering inside `getCodesForType` (extract prompt
vocabulary — retired codes never shown to the model);
`enforceCanonicalCodes`/`isValidCode` treats a retired code as a typed
REMAP to its `superseded_by` target when unambiguous, else typed
rejection to review — NEVER silent acceptance. Classify prior-snapshot
CACHE INVALIDATION: cached `provisionCode` values that are retired are
dropped (cache bypass for affected sections) so `--classify-only
--apply` cannot carry old codes forward. Acceptance adds: extract
prompts contain zero retired codes; a synthetic model response
emitting a retired code produces the typed remap/rejection.

## 3. Safety check (the CLAUDE.md rule, mechanized)

Extend the `safety-check-nosol-rule.js` pattern: a new
`scripts/safety-check-reclass-rules.js` that
1. loads pre-change `tryDeterministic`/`refineSubCode` from
   `git show HEAD:` and diffs against the new rules over EVERY deal's
   stored `classified_sections` snapshot (read-only);
2. hard-pins the EXPECTED flip set — exactly the cards the corpus
   investigation enumerated (19 CONSENT, 10 REGSTATUS, 44 REP-B ANTIRELIANCE/NOREP cards, PLUS
   the REP-T-NOREP population — audit A-M1: uncounted in the ack; the
   slice's FIRST step is the read-only corpus count of REP-T-NOREP,
   added to the pin by deal + section_ref before any rule edits) plus the
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
place; claims anchored via excerpt_id survive. **Pinned per-deal order (audit A-C3 — reprocess NEVER writes cards):**
classify-only apply → per-type extract apply → `node
scripts/backfill/extract-to-cards.js --deal <id> --apply` (the ONLY
production card writer; its upsert/replaceDeal semantics are what the
scout verified) → claim rematerialization. The backfill's
`extraction_version` label is BUMPED for this pass
(`m2-01-reclass-v1`, audit A-M4) so the comparator's
`isComparisonReceiptStale` actually fires on pre-reclass receipts;
acceptance asserts the new label. Order: the three
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
  `GOVAPPROVAL`+`NOCONFLICT`; the proposed cross-party
  `STOCKAPPROVAL`+`REP-B-VOTE` union is WITHDRAWN (audit A-M5:
  cross-party unions are a novel hazard — occurrence-order pairing
  could pair a buyer vote rep against another deal's target approval
  rep, and the rows may never co-list). STOCKAPPROVAL renders as its
  own row; any future cross-party grouping is a Fable+Ben design
  item with party-aware pairing, not a rename rider.
  `compare-row-union.test.js` updated.
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
- `canonicalize-duplicate-codes.js` stale comment refreshed; ALSO
  (audit A-m2): `pages/review-v1/[id].js` per-code label map gains the
  element codes; stale comments in `lib/abry.js:23` and
  `representations-qualifiers.config.js:45` refreshed.
- **Sequencing (audit cross-cutting): this slice builds AFTER the
  comparator-wiring slice (order B → A) and OWNS re-deriving that
  slice's expected-count tables + re-exporting all three snapshots
  when the reclassification lands.**

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
