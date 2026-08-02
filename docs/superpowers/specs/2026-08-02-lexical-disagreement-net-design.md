# Lexical-disagreement net (auto-pass condition 2 of 2)

**Date:** 2026-08-02. **Status:** DRAFT — pending adversarial audit.
**Why now:** `candidate-resolution.js` blocks auto-pass on
`LEXICAL_DISAGREEMENT_NET_ABSENT`, the last of the two M3 conditions the
code cannot evaluate (the v1↔v2 comparator landed 2026-08-02, PR #471).
Until this net exists every clean claim queues for Ben — the binding
constraint on corpus-scale economics. When this slice lands, auto-pass
becomes *mechanically evaluable* for the first time; it still does not
OPEN without Ben's explicit sign-off (see "What this slice does not do").

## Protocol authority

Everything here implements two clauses of Ben's M3 protocol
(docs/codex-program/EXECUTION-LEDGER.md), which this spec may not amend:

1. **Auto-pass clause:** "lexical disagreement set holds no unmatched
   signal that could change the result."
2. **Extraction semantics rule 2:** "Lexical disagreement vetoes
   negatives, never creates positives." A lexical hit the semantic
   producer missed prevents `ABSENT` (drops the scope to `NOT_EXAMINED`,
   review queue); it NEVER becomes a `PRESENT` claim, because a pattern
   match can sit in a recital or govern something else.
3. **Structural blindness to novelty is accepted:** the net matches only
   registered codes; the open-world path (not this net) catches new
   propositions. This net must therefore never be argued as a recall
   guarantee — it is a *disagreement detector over the known taxonomy*.

## Design

### 1. Module: `lib/canonical-v2/native-producer/lexical-disagreement-net.js`

PURE, DETERMINISTIC, NO MODEL CALLS, NO NETWORK, NO DB — the same
contract as `v1v2-comparator.js`, and the same receipt conventions.
Exactly these inputs decide every outcome:

- `governed_section`: `{ section_ref, text, text_sha256 }` — the same
  section slice the producer was licensed to see. The module verifies
  `text_sha256` itself and fails typed (`SECTION_HASH_MISMATCH`) on
  disagreement; it never trusts the caller's hash.
- `candidates`: the run's compiled candidates for this section — each
  `{ closure_id, family, evidence: [{start, end}] }` with SECTION-LOCAL
  UTF-8 byte offsets (the recorded coordinate-frame convention; the
  module asserts `0 <= start < end <= byteLength(text)` and fails typed
  `EVIDENCE_OUT_OF_FRAME` rather than mis-attributing).
- `lexicon`: a frozen, versioned lexicon table (section 2).

Output: a content-addressed `LEXICAL_DISAGREEMENT_RECEIPT/V1` carrying
per-family observation lists and the disagreement set (section 3).

### 2. The lexicon: `LEXICAL_FAMILY_LEXICON/V1`

A frozen table in the module (the `v1v2-comparator.js` mapping-table
convention: versioned constant, content-hashed into every receipt, any
edit is a new version and a reviewed diff).

Shape: `{ family_code: [ { pattern_id, kind, value } ] }` where `kind`
is `LITERAL_PHRASE` (case-insensitive, zero-width/bidi-tolerant match
via `normaliseForMatching`, the coverage-proxies precedent) or
`BOUNDED_REGEX` (anchored word-boundary regex with NO unbounded
quantifiers over arbitrary text — every regex must match within a
128-normalised-char window, enforced by a table-validation test, so no
pattern can be pathological on a 400KB document).

**Legal content (Fable-authored, Ben-reviewable in the PR diff).**
Initial scope = the families the native producer actually extracts
today (the capital-structure/capitalisation slice), NOT all of M&A:

- `CAPITALIZATION`: "authorized", "issued and outstanding", "reserved
  for issuance", "treasury shares/stock", "preferred stock", "options",
  "restricted stock unit/RSU", "performance stock unit/PSU", "warrant",
  "convertible", "ESPP/employee stock purchase", "phantom", "SAR/stock
  appreciation right", "equity award", "voting debt".
- Each entry records WHY it is a tell (one comment line each), because
  the lexicon is exactly the kind of plausible-looking artifact where a
  wrong entry reads as correct. Deletions are harder than additions:
  removing a pattern narrows the veto and therefore widens auto-pass —
  the table doc-comment says so and requires a Fable-reviewed rationale
  per removal.

Families with no lexicon entry are TYPED as
`LEXICON_FAMILY_UNCOVERED` in the receipt — never silently treated as
"no signals, all clear". An uncovered family cannot satisfy condition 2
(it keeps blocking auto-pass for claims of that family), which makes
lexicon coverage growth self-motivating and prevents the worst failure:
a family auto-passing because nobody wrote its patterns yet.

### 3. Matching semantics and the disagreement set

For each family with lexicon coverage:

1. Find every pattern hit in the normalised section text; map each hit
   back to ORIGINAL byte offsets (the qualifier-kind-lexicon convention:
   offsets into the un-normalised text so callers can byte-verify; a
   hit that fails round-trip reproduction is itself a typed defect
   `HIT_OFFSET_IRREPRODUCIBLE`, never silently dropped).
2. A hit is **MATCHED** iff it overlaps (any byte in common — strict
   containment is NOT required, qualifier spans legitimately clip
   phrase edges) at least one evidence span of at least one candidate
   of the SAME family. Cross-family evidence never matches a hit —
   a CAPITALIZATION tell inside a no-shop candidate's span is still a
   missed capitalisation signal.
3. Every unmatched hit enters the **disagreement set** as
   `{ family, pattern_id, start, end, excerpt }` (excerpt = the hit
   plus a fixed ±80-byte context window, clamped to the section, for
   the review queue — a reviewer must be able to look without re-running
   anything).

Pinned decisions (defaults chosen so every ambiguity errs toward MORE
review, never less — the only safe direction for a veto net):

- **Overlap, not containment or adjacency-window.** A ±N tolerance
  window would be a tunable that silently widens auto-pass; overlap is
  parameter-free. A real signal the producer cited imprecisely still
  matches; a signal it never touched never does.
- **Recitals/definitions ARE scanned.** M3 anticipates recital false
  positives and prices them: they veto (cost: one review-queue item),
  never fabricate. No "smart" recital exclusion — that is a recall hole
  wearing a convenience costume.
- **Zero candidates for a covered family** = every hit for that family
  is unmatched. This is the ABSENT-veto case, not an error.

### 4. Receipt: `LEXICAL_DISAGREEMENT_RECEIPT/V1`

Content-addressed (v1v2 conventions): pins `lexicon_version` +
lexicon content hash, `section_ref` + `text_sha256`, the candidate-set
digest (sorted closure_ids), per-family outcome
(`LEXICAL_ALL_SIGNALS_MATCHED` | `LEXICAL_UNMATCHED_SIGNALS` +
disagreement set | `LEXICON_FAMILY_UNCOVERED`), and counts. Plus a
staleness helper mirroring the v1v2 comparator's: a receipt minted
against a different section hash or candidate digest than the one being
resolved is typed STALE and satisfies nothing.

Determinism: same inputs in any candidate order → byte-identical
receipt (permutation test pinned).

### 5. Wiring into `candidate-resolution.js`

Mirrors the v1v2 wiring exactly — optional input, strictly additive:

- New optional `lexical_disagreement` input. ABSENT → behavior is
  byte-identical to today (`LEXICAL_DISAGREEMENT_NET_ABSENT` remains in
  `unevaluated_conditions`; the no-input `resolution_receipt_id` pins
  stay untouched — same additivity test as the comparator wiring).
- PRESENT and fresh, for a claim whose family shows
  `LEXICAL_ALL_SIGNALS_MATCHED`: the condition is evaluated-and-passed;
  the entry leaves `unevaluated_conditions`.
- PRESENT with `LEXICAL_UNMATCHED_SIGNALS` for the claim's family:
  typed gate failure `LEXICAL_UNMATCHED_SIGNAL_IN_SCOPE` into the SAME
  gate-failure flow as every structural check — the M3 "lexical net
  flags a potentially missed proposition" → Ben review branch. The
  disagreement excerpts travel on the queue item.
- PRESENT with `LEXICON_FAMILY_UNCOVERED` for the claim's family: a
  typed `LEXICAL_LEXICON_UNCOVERED_FAMILY` stays in
  `unevaluated_conditions` (evaluated-but-unevaluable ≠ passed; the
  option-A precedent).
- Auto-pass arithmetic: with both nets present and clean, the
  `unevaluated_conditions` array can now be EMPTY for the first time.
  A claim with empty unevaluated conditions and all gates green
  computes `auto_pass_eligible: true` — but the resolution still emits
  it to the review queue with a `AUTO_PASS_ELIGIBLE_PENDING_PROTOCOL
  _ACTIVATION` marker, because opening auto-pass (actually skipping
  the queue) is Ben's sign-off plus the sampling machinery, neither of
  which this slice touches. Eligibility becomes VISIBLE, routing does
  not change. This gives Ben real queue data ("N% of claims would have
  auto-passed") before he decides anything.

### 6. ABSENT veto (extraction semantics rule 2)

The scope-closure/ABSENT-derivation machinery does not exist yet (the
producer never asserts negatives; nothing currently derives `ABSENT`).
This slice therefore ships the veto as a PURE HELPER on the net module:
`absentConclusionPermitted(receipt, family)` → `{ permitted: false,
reason: 'LEXICAL_UNMATCHED_SIGNALS' | 'LEXICON_FAMILY_UNCOVERED' |
'RECEIPT_STALE', ... }` or `{ permitted: true }` — with tests pinning
that an uncovered family and a stale receipt both refuse permission
(fail-closed in all three directions). When the ABSENT deriver is
built, it consumes this helper; nothing about the helper's contract is
"TBD".

## Tests (acceptance criteria for the build)

Real-fixture-first, the comparator slice's standard:

1. Recorded F28/QXO governed section (`tests/fixtures/qxo-section-3-1-b.txt`
   or the richest committed live-run section) + its recorded candidates:
   every lexicon hit in the section enumerated; matched/unmatched split
   asserted against hand-verified expectations (the hand-verification is
   part of the review, as the TopBuild snapshot hash was).
2. Zero-candidate section (covered family) → all hits unmatched,
   `absentConclusionPermitted` refuses.
3. Determinism + candidate-order permutation → byte-identical receipts.
4. Additivity: no-input `resolution_receipt_id` byte-identical to the
   committed pins (both fixture sets).
5. Cross-family evidence does NOT match a hit.
6. Overlap-not-containment: evidence span clipping a phrase edge still
   matches; disjoint span does not.
7. Lexicon table validation: every regex bounded, every pattern has
   `pattern_id` + rationale comment, table content-hash pinned.
8. Staleness: wrong section hash / wrong candidate digest → typed STALE,
   satisfies nothing, refuses ABSENT permission.
9. `AUTO_PASS_ELIGIBLE_PENDING_PROTOCOL_ACTIVATION`: with both receipts
   clean, eligibility computes true, routing still queues.
10. Full suite + build green; forbidden-patterns clean (lexicon literals
    are code-class strings — if any collide with prose fingerprints,
    the exemption goes through the same reviewed route as the snapshot
    fixture's, never a silent pattern deletion).

## What this slice does not do

No model calls; no recall guarantee beyond the registered lexicon; no
opening of auto-pass routing (Ben's sign-off + sampling certification
remain prerequisites, unchanged); no scope-closure/ABSENT deriver; no
v1 mutation; no tolerance windows or tunables.

## Known costs, stated up front

- Recital/cross-reference false positives queue for review by design.
  The queue data itself will show the rate; if it is punishing, the fix
  is a REVIEWED lexicon refinement or a scoping rule ratified by Ben —
  never a silent module-side heuristic.
- The lexicon starts narrow (capitalisation families). Every other
  family remains `LEXICON_FAMILY_UNCOVERED` and keeps blocking — corpus
  economics improve family by family, which is the honest shape of the
  work.
