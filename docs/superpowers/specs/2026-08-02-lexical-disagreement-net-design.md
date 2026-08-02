# Lexical-disagreement net (auto-pass condition 2 of 2)

**Date:** 2026-08-02. **Status:** AUDIT-AMENDED — adversarial audit
returned AMEND (4 critical, 6 material findings); every amendment is
folded in below. One interpretation is flagged for Ben's one-line
ratification at PR review (see "Protocol authority", item 4) — it does
not block the build.
**Why now:** `candidate-resolution.js` blocks auto-pass on
`LEXICAL_DISAGREEMENT_NET_ABSENT`, the last of the two M3 conditions the
code cannot evaluate (the v1↔v2 comparator landed 2026-08-02, PR #471).
Until this net exists every clean claim queues for Ben — the binding
constraint on corpus-scale economics.

## Protocol authority

This spec implements clauses of Ben's M3 protocol
(docs/codex-program/EXECUTION-LEDGER.md) and may not amend them:

1. **Auto-pass clause:** "lexical disagreement set holds no unmatched
   signal that could change the result."
2. **Extraction semantics rule 2:** "Lexical disagreement vetoes
   negatives, never creates positives." A lexical hit the semantic
   producer missed prevents `ABSENT` (drops the scope to `NOT_EXAMINED`,
   review queue); it NEVER becomes a `PRESENT` claim.
3. Ledger note, accepted: the net matches only registered codes and is
   structurally blind to novelty — the open-world path catches new
   propositions. This net is a *disagreement detector over the known
   taxonomy*, never a recall guarantee.
4. **INTERPRETATION REQUIRING BEN'S RATIFICATION (audit finding M3).**
   "Could change the result" is implemented as SAME-FAMILY-WITHIN-THE-
   GOVERNED-SECTION: an unmatched hit of family X blocks condition 2
   for family-X claims in that section; it does not block a family-Y
   claim in the same section (the X hit still vetoes via X's own
   family outcome, still queues, and still refuses `ABSENT` for X).
   Rationale: a missed no-shop tell does not change a capitalisation
   date's result; the strictest reading (any unmatched signal blocks
   every claim in the section) would also make condition 2 unpassable
   until every family has a lexicon, producing no eligibility data at
   all. This is a READING of the protocol, not a mechanical
   consequence — **RATIFIED by Ben at PR #472 review (2026-08-02), together with the
   digest erratum acknowledgment.** Standing note: Ben granted merge
   authority without per-PR confirmation going forward.

## Design

### 1. Module: `lib/canonical-v2/native-producer/lexical-disagreement-net.js`

PURE, DETERMINISTIC, NO MODEL CALLS, NO NETWORK, NO DB — the
`v1v2-comparator.js` contract and receipt conventions. Exactly these
inputs decide every outcome:

- `governed_section`: `{ section_ref, text, text_sha256 }`. The module
  recomputes and verifies `text_sha256` itself; disagreement is typed
  `SECTION_HASH_MISMATCH`, fail-closed.
- `candidates`: the run's compiled candidates FOR THIS SECTION — each
  `{ closure_id, section_reference, family, evidence: [{start, end}] }`
  with SECTION-LOCAL UTF-8 byte offsets. Two rejections, both typed and
  fail-closed (never skip-and-continue):
  - `CANDIDATE_SECTION_MISMATCH` (audit C3): any candidate whose
    `section_reference` differs from `governed_section.section_ref`.
    Offsets from another section can land inside this section's byte
    range and launder an unmatched hit into a match; binding is
    checked by reference equality, never by frame-fit.
  - `EVIDENCE_OUT_OF_FRAME`: any span violating
    `0 <= start < end <= utf8ByteLength(text)`.
- `lexicon`: the frozen versioned table (section 2).

Output: `LEXICAL_DISAGREEMENT_RECEIPT/V1` (section 4).

### 2. The lexicon: `LEXICAL_FAMILY_LEXICON/V1`

Frozen table in the module (versioned constant, content-hashed into
every receipt; any edit is a new version and a reviewed diff).

**Family vocabulary (audit C1).** Lexicon keys are the pipeline's REAL
family codes — the registered `concept_key` values that
`candidate-resolution.js` stamps as `family` (e.g. `REP-T-CAP`), NOT
invented names. A table-validation test asserts every lexicon key is a
registered concept key; an unknown key fails the table, never silently
scans nothing.

Pattern kinds:

- `LITERAL_PHRASE`: case-insensitive, zero-width/bidi-tolerant
  (`normaliseForMatching`). **Word-boundary rule (audit M2):** a hit is
  valid only when both edges abut a character outside `[A-Za-z0-9]` in
  the normalised text (or the text boundary). No naked-substring hits:
  "options" must not fire inside "optionally".
- `LITERAL_ACRONYM` (audit M2): CASE-SENSITIVE, same boundary rule.
  For RSU/PSU/SAR/ESPP/DSU-class tokens — case-insensitive matching
  would fire "RSU" inside "puRSUant" and "SAR" inside "necesSARy" /
  "Sarbanes-Oxley", flooding every section with noise. Predictable
  noise is itself a widener at one remove: it pressures the review
  process into lexicon deletions, and deletions widen auto-pass.
- `BOUNDED_REGEX` (audit M5): syntactically restricted — literals,
  character classes, alternation, bounded `{m,n}` only; NO unbounded
  quantifiers (`*`, `+`, unbounded `{m,}`). The restriction yields a
  statically computable maximum match length; the table-validation
  test computes it and asserts ≤ 128 normalised chars. Matching runs
  ONCE over the whole normalised text, standard leftmost scan — no
  windowing.

Multi-form entries expand to SEPARATE `pattern_id`s (audit m2):
"treasury shares/stock" is two patterns, never a literal `/`.

**Legal content (Fable-authored; Ben-reviewable line by line in the PR
diff).** Initial coverage: `REP-T-CAP` (the family the producer
extracts today). Each entry carries a one-line rationale comment.

- Phrases: "authorized capital stock", "capital stock", "issued and
  outstanding", "reserved for issuance", "treasury shares", "treasury
  stock", "preferred stock", "par value", "equity interest", "equity
  interests", "equity award", "restricted stock", "stock appreciation
  right", "employee stock purchase", "deferred stock unit", "profits
  interest", "incentive plan", "phantom", "convertible", "voting
  debt", "voting securities", "warrants to purchase", "warrant
  agreement", "warrants exercisable".
- Acronyms (`LITERAL_ACRONYM`): "RSU", "RSUs", "PSU", "PSUs", "SAR",
  "SARs", "ESPP", "DSU", "DSUs".
- "option" family: `BOUNDED_REGEX` `/\boptions?\b/` case-insensitive
  is still too noisy ("option to terminate"); use the phrases "stock
  option", "Company Option", "option plan" instead. RULED HERE: the
  naked noun "option(s)" is excluded; the blind spot (a capitalisation
  rep whose only tell is the bare word "options") is priced and
  recorded — the v1 comparator and open-world path cover that shape.
- "warrant" RULED HERE: the bare token is excluded because
  "represents and warrants" appears in the chapeau of essentially
  every representation section; only the purchase-instrument phrases
  above are patterns. Residual blind spot (e.g. "no warrants are
  outstanding") priced and recorded: it is exactly the kind of
  sentence the phrases "issued and outstanding"/"warrants
  exercisable" usually accompany, and the veto-only design means the
  cost of a miss here is a missed VETO, never a wrong claim.
- Deletion asymmetry, in the table doc-comment: removing a pattern
  narrows the veto and widens auto-pass; every removal requires a
  Fable-reviewed rationale. Additions only narrow auto-pass and are
  cheap.

Families with no lexicon entry are typed `LEXICON_FAMILY_UNCOVERED` —
never silently clean. An uncovered family cannot satisfy condition 2.

### 3. Matching semantics and the disagreement set

For each covered family:

1. Match every pattern against `normaliseForMatching(text)`.
2. **Offset mapping (audit M1), pinned exactly:** matching yields
   normalised string indices. Each normalised index maps to an
   ORIGINAL string index via the normaliser's position map; the
   original string index maps to a UTF-8 byte offset as
   `Buffer.byteLength(original.slice(0, idx), 'utf8')`. The hit's END
   maps the position AFTER the last matched normalised character, so
   zero-width bytes INSIDE the matched phrase are included in the
   original span. Round-trip predicate, per hit:
   `normaliseForMatching(utf8Slice(original, start, end)) ===
   matchedNormalisedText` — failure is typed
   `HIT_OFFSET_IRREPRODUCIBLE`, the hit is REPORTED as irreproducible
   (never silently dropped), and an irreproducible hit counts as
   UNMATCHED for every consumer (fail toward review).
3. A hit is **MATCHED** iff it byte-overlaps (any byte in common —
   containment not required, evidence legitimately clips phrase
   edges) at least one evidence span of at least one candidate of the
   SAME family. Cross-family evidence never matches a hit.
4. Every unmatched hit enters the **disagreement set** as
   `{ family, pattern_id, start, end, excerpt }`. Excerpt = hit ±80
   bytes, clamped to the section, then SNAPPED INWARD to UTF-8
   character boundaries (audit m3) so the excerpt is always valid
   UTF-8 and receipts stay byte-identical across implementations.

Pinned decisions (every ambiguity errs toward MORE review):

- Overlap, not containment, no tolerance windows — parameter-free.
- Recitals/definitions ARE scanned; false positives veto (cost: a
  queue item), never fabricate. No recital-exclusion heuristics.
- Zero candidates for a covered family = every hit unmatched (the
  ABSENT-veto case, not an error).
- **Known limitation, named (audit m4):** one candidate with a very
  wide evidence span marks every same-family hit inside it matched;
  the net is blind to N distinct propositions under one broad quote.
  The claim-level gates (MULTI_SPAN_COMPOSED etc.) still apply. The
  receipt carries, per family, the max evidence-span share of the
  section so this blindness is measurable from queue data.

### 4. Receipt: `LEXICAL_DISAGREEMENT_RECEIPT/V1`

Content-addressed. Pins: `lexicon_version` + lexicon content hash,
`section_ref` + `text_sha256`, `candidate_digest` (sorted closure_ids,
recomputable by any consumer), per-family outcomes, counts, and per-
family max-evidence-span share.

**Per-family outcome domain (audit M6), pinned:** the receipt
enumerates exactly one outcome for every family in the SORTED UNION of
(lexicon table keys ∪ families of the passed candidates):
`LEXICAL_ALL_SIGNALS_MATCHED` | `LEXICAL_UNMATCHED_SIGNALS` (+
disagreement set) | `LEXICON_FAMILY_UNCOVERED`. Any family OUTSIDE the
enumerated domain is, by definition, `LEXICON_FAMILY_UNCOVERED` to
every consumer — a missing row can never read as clean.

Determinism: byte-identical receipts under candidate-order permutation
AND lexicon-entry-order permutation (audit m6; the table is iterated in
sorted pattern_id order, pinned by test).

### 5. Wiring into `candidate-resolution.js`

Optional input, strictly additive — but with RECEIPT BINDING ENFORCED
IN THE WIRING (audit C2; the v1v2 wiring's schema-only validation is
NOT the model here, because this receipt gates a condition
immediately):

- New optional `lexical_disagreement` input: a MAP of receipts keyed by
  `section_ref` (a run has many sections; one receipt covers one
  section).
- ABSENT input → byte-identical behavior to today;
  `LEXICAL_DISAGREEMENT_NET_ABSENT` stays; no-input
  `resolution_receipt_id` pins untouched.
- For each claim, the wiring verifies BEFORE consuming any outcome:
  1. a receipt exists for the claim's own governing section
     reference; and
  2. `receipt.text_sha256` equals that section's hash in the run
     receipt's `resolved_sections`; and
  3. `receipt.candidate_digest` equals the digest the wiring itself
     recomputes from the RESOLVED candidates for that section (via the
     net module's exported `computeSectionCandidatesForLexicalDigest`);
     and
     **[ERRATUM 2026-08-02, recorded at Fable review]** this bullet
     originally read "from the run's compiled candidates". That is
     unimplementable: compiled candidates carry no family/concept_key
     (families are stamped at resolution — `mapping.concept_key`), and
     digesting the 37-candidate compiled set against a 3-candidate
     resolved mint would make every honest receipt permanently stale.
     The honest end-to-end flow is two-pass (resolve → mint receipts →
     resolve again); determinism holds because wiring touches only
     triage, never closure_id/concept_key/evidence. Evidence remains
     transitively bound: closure_id is content-addressed over the
     claim revision including evidence spans; and
  4. the receipt validates structurally (schema, outcome domain).
  ANY failure → the receipt satisfies nothing for that claim: a typed
  `LEXICAL_RECEIPT_STALE` (mismatch) or `LEXICAL_RECEIPT_MALFORMED`
  (structure) replaces nothing and `LEXICAL_DISAGREEMENT_NET_ABSENT`
  REMAINS in `unevaluated_conditions`. A claim in a section with no
  receipt keeps ABSENT. Fail-closed in every branch.
- Receipt bound and fresh, claim's family outcome
  `LEXICAL_ALL_SIGNALS_MATCHED` → condition 2 evaluated-and-passed;
  the entry leaves `unevaluated_conditions`.
- `LEXICAL_UNMATCHED_SIGNALS` for the claim's family → typed gate
  failure `LEXICAL_UNMATCHED_SIGNAL_IN_SCOPE` into the standard gate-
  failure flow (M3's "lexical net flags a potentially missed
  proposition" → Ben review); disagreement excerpts travel on the
  queue item.
- `LEXICON_FAMILY_UNCOVERED` — or the claim's family MISSING from the
  receipt's outcome domain entirely (audit C1) → typed
  `LEXICAL_LEXICON_UNCOVERED_FAMILY` stays in
  `unevaluated_conditions`. Evaluated-but-unevaluable ≠ passed.

**Auto-pass arithmetic (audit M4).** Two M3 conditions remain
STRUCTURALLY UNREPRESENTED in this stage even after both nets:
certified-complete source scope (the scope-closure machinery does not
exist) and mandatory-review selection of high-risk propositions. So
this slice ALSO adds a third permanent entry
`SOURCE_SCOPE_CERTIFICATION_ABSENT` to `unevaluated_conditions`
(removed only when the scope-closure slice lands), keeping the
invariant "empty array = every protocol condition mechanically
evaluated" TRUE — the doctrine that a check never run must never look
passed. For Ben's queue data, the resolution emits an instrumentation
marker `both_nets_clean: true` on claims where conditions 1 and 2 both
evaluated clean; the review-queue artifact aggregates the count. The
marker is DATA ONLY: routing is unchanged, nothing skips the queue,
and the marker's name says what it is rather than overclaiming
"auto-pass eligible".

### 6. ABSENT veto (extraction semantics rule 2)

The scope-closure/ABSENT-derivation machinery does not exist yet.
This slice ships the veto as a pure helper on the net module, with a
signature that CAN actually detect staleness (audit C4):

`absentConclusionPermitted({ receipt, family, current_section_sha256,
current_candidate_digest })` →
`{ permitted: false, reason: 'LEXICAL_UNMATCHED_SIGNALS' |
'LEXICON_FAMILY_UNCOVERED' | 'RECEIPT_STALE' | 'RECEIPT_MALFORMED' }`
or `{ permitted: true }`.

Fail-closed in EVERY branch: missing or mismatching current-state
inputs → `RECEIPT_STALE` (absence of proof of freshness IS staleness);
schema/shape validation failure → `RECEIPT_MALFORMED`, never
`permitted: true`; family uncovered or missing from the outcome domain
→ `LEXICON_FAMILY_UNCOVERED`. When the ABSENT deriver is built it
consumes this helper; nothing in its contract is TBD.

## Tests (acceptance criteria for the build)

1. Real recorded governed section + its recorded candidates: every
   lexicon hit enumerated; matched/unmatched split asserted against
   hand-verified expectations (hand-verification recorded in review).
2. Zero-candidate section (covered family) → all hits unmatched;
   `absentConclusionPermitted` refuses.
3. Determinism: candidate-order AND lexicon-entry-order permutations →
   byte-identical receipts.
4. Additivity: no-input `resolution_receipt_id` byte-identical to
   committed pins.
5. Cross-family evidence does not match a hit.
6. Overlap-not-containment: clipping span matches; disjoint does not.
7. Table validation: keys are registered concept keys; regexes
   syntactically restricted with static max match ≤ 128; every pattern
   has id + rationale; content hash pinned.
8. **Anti-noise regression (audit M2):** every pattern run against a
   pinned prose paragraph containing "pursuant", "necessary",
   "Sarbanes-Oxley", "represents and warrants", "optionally" —
   asserted hit set exactly empty.
9. **Offset fixture (audit M1):** a fixture with a multi-byte
   character BEFORE the hit and a zero-width mark INSIDE the hit
   phrase — byte offsets and round-trip predicate asserted.
10. Wrong-section receipt does not clear condition 2; multi-section
    fixture where only one section has a receipt — the other keeps
    ABSENT (audit C2).
11. `CANDIDATE_SECTION_MISMATCH`: foreign-section candidate whose
    offsets fit the frame is rejected, not matched (audit C3).
12. Claim family missing from receipt outcome domain → treated as
    uncovered, still blocked (audit C1).
13. Wiring fail-closed on malformed receipt (audit m6) and on stale
    candidate digest.
14. Helper: stale, uncovered, malformed, missing-current-state →
    refused; fresh-and-clean → permitted.
15. `both_nets_clean` marker: computes true only with both receipts
    bound, fresh and clean; routing unchanged (still queues);
    `SOURCE_SCOPE_CERTIFICATION_ABSENT` present in
    `unevaluated_conditions` in the same fixture.
16. Full suite + build green; forbidden-patterns clean (any collision
    goes through the reviewed exemption route, never pattern
    deletion).

## What this slice does not do

No model calls; no recall guarantee beyond the registered lexicon; no
opening of auto-pass routing; no scope-closure/ABSENT deriver; no v1
mutation; no tunables; no wide-span blindness fix (measured instead —
section 3).

## Known costs, stated up front

- Recital/cross-reference false positives queue by design; queue data
  measures the rate; the remedy is a reviewed lexicon refinement or a
  Ben-ratified scoping rule, never a module-side heuristic.
- The lexicon starts at one family (`REP-T-CAP`); everything else is
  `LEXICON_FAMILY_UNCOVERED` and keeps blocking. Corpus economics
  improve family by family — the honest shape of the work.
- Ruled-out patterns (naked "option(s)", naked "warrant(s)") are
  recorded blind spots, priced against their noise cost above; the v1
  comparator and open-world path cover those shapes.
