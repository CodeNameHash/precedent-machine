# KEY_DEFINED_TERMS zero publishable claims — located and fixed

Evidence: `evidence/canonical-v2/modiv-key-defined-terms-8.12-20260807-live/`
(§8.12 pin, resolved 10, review_queue 17, open_world 2, publishable claims 0
as committed). Step 2A's §8.12 pin fix is genuinely correct — §8.5 is
"Interpretation; Certain Definitions" (construction conventions), §8.12 is
"Definitions" — and this run resolves 10 real candidates from the right
section. This is a second, narrower defect sitting behind that fix, exactly
as `docs/core/PLAN.md` section 2 predicted.

## Where the loss happens (counts, not inference)

Traced with `node -e` queries against the committed evidence files, then
confirmed with a real replay (below) — no guessing:

| Stage | Count |
|---|---|
| `resolution.json` `resolved` | 10 |
| `resolution.json` `review_queue` | 17 |
| `resolution.json` `open_world` | 2 |
| `adapter-result.json` `counts.candidates_written` | **0** |
| `adapter-result.json` `counts.candidates_rejected_by_coordinate_shift` | **10** |
| `adapter-result.json` `residuals` | 10, all `EVIDENCE_COORDINATE_SHIFT_FAILED` / `EVIDENCE_SHIFT_TEXT_MISMATCH` |
| `validation.json` `publishableWriteSet.claims` | 0 (provisions: 5, claims: **0**) |

All 10 resolver-produced claims — genuinely resolved, `publication_state:
VALIDATED`, no quarantine, no failure — die in
`lib/canonical-v2/native-producer/native-write-set-adapter.js`'s coordinate-
shift verification, `shiftEdge`/`expectedTextForEdge`. Every single one, not
some. This is the "claim with no governing provision is dropped, not
rejected" behaviour named in the brief, but the drop reason wasn't a missing
provision — the resolver already minted 5 `STRUCTURAL_PROVISION_INSTANCE`
rows (`DEF-SUPERIOR`, `DEF-INTERVENING`, `DEF-KNOWLEDGE`, `DEF-WILLFUL`,
`DEF-TAX-RETURN`), the exact "5 provisions carrying no attached claim" from
the finding. The claims never reached them.

## What the 10 resolved candidates actually are

Checked before assuming they deserved to publish, per the brief's
instruction. All 10 are substantive, already-registered `KEY_DEFINED_TERMS`
claim definitions — not construction-convention noise like the pre-Step-2A
"include"/"hereof"/"days" candidates the finding warned about:

- `SUPERIOR_PROPOSAL_QUALIFIER` (1) — the financial-favorability qualifier
  inside "Superior Proposal"
- `INTERVENING_EVENT_EXCLUSION` (2) — carve-outs from "Intervening Event"
- `KNOWLEDGE_STANDARD` (2) + `KNOWLEDGE_PERSON_SOURCE` (2) — the "know"/
  "knowledge" definition's standard and its named-persons source, twice
  (Company side and Parent side)
- `WILLFUL_BREACH_DEFINITION` (1) + `WILLFUL_BREACH_KNOWLEDGE_STANDARD` (1)
  — "Willful and Intentional Breach"
- `TAX_RETURN_DEFINITION_RECORDED` (1) — "Tax Return"

Each already has a registered `claim_definition_key`, a mapped concept key,
and a minted governing provision. There is no taxonomy gap here — this is
squarely an ordinary defect, not a Step 3H design question.

## Root cause: a stale invariant in `native-write-set-adapter.js`

`native-extraction-run.js`'s `checkEvidenceScope` (compile-time, the ACTUAL
gate on what a candidate's evidence is allowed to look like) has a named
exception, in its own code and its own comment:

```js
// A defined-term proposal has two independently byte-verified spans:
// its definition head and its operative limb.  The producer's raw
// value is deliberately the limb, so compare the head edge with its
// own retained quote rather than treating a valid multi-span fact as
// an out-of-scope candidate.
const expected = edge.evidence_role === 'DEFINITION'
  ? proposal.attributes?.definition_head_quote
  : proposal.raw_value;
```

`native-write-set-adapter.js`'s `expectedTextForEdge` — the post-shift
re-verification that runs when evidence moves from section-local to
document-absolute coordinates — did **not** carry this exception. Its own
header comment asserted the invariant `checkEvidenceScope` actually
enforces is simpler than it is ("this pipeline only ever produces evidence
whose section-local slice already equals the compiled row's own
`raw_value`") — a header claim that was true for every claim shape this
module had been exercised against until a defined-term claim's two-role
evidence exposed it. This is exactly the "stale header is the most
authoritative-looking lie" failure `CLAUDE.md` names, just one level deeper
in the call stack than the file it names as the historical example.

**Confirmed this is not the byte-offset trap.** Rebuilt the real canonical
text from the committed raw HTML (`sec-html-canonical-text.js`,
independently re-verified `canonical_text_sha256` against the pin) and read
both evidence spans at their real document-absolute byte offsets directly:

```
absolute 410850–410928: "“Superior Proposal” means a bona fide written Company Acquisition Proposal"
absolute 411797–411909: "would result in a transaction that is more favorable to the Company and its stockholders than the Company Merger"
```

Both are correct, real, in-place document text — the DEFINITION edge and
the OPERATIVE_TEXT edge each land exactly where they should. The adapter
was comparing the DEFINITION edge's correct text against the claim's
`raw_value` (which is the OPERATIVE_TEXT edge's text) and rejecting the
mismatch as `EVIDENCE_SHIFT_TEXT_MISMATCH`. Checked all 10 residuals in
`adapter-result.json`: every failing edge has `evidence_role: 'DEFINITION'`,
and every `actual` value is that provision's real `definition_head_quote`
text while `expected` (`raw_value`) is a different, later span in the same
provision. Confirmed via `resolution.json`'s `check-multi.js` sweep across
every other evidence directory in the repo that no other family's resolved
candidates currently carry this two-role evidence shape, so the blast
radius of the pre-fix bug was `KEY_DEFINED_TERMS` only.

## The fix

`lib/canonical-v2/native-producer/native-write-set-adapter.js`,
`expectedTextForEdge`: mirrors `checkEvidenceScope`'s exception exactly — a
`DEFINITION`-role edge on a claim is checked against
`row.attributes.definition_head_quote` when present; every other edge is
checked against `row.raw_value`, unchanged. Header comment above the
function rewritten to state the real invariant and record the 2026-08-07
finding, instead of the narrower one that was silently false for this
shape.

No change to `candidate-resolution.js`. Checked it first, since it's the
file that builds these claims (`handleDefinedTermCandidate`,
`rebuildClaim`) — it carries `raw_value` and `evidence` straight through
from the original compiled candidate unchanged, exactly as
`checkEvidenceScope` already proved correct at compile time. The defect was
entirely downstream, in the adapter's post-shift re-check.

## Before / after — real replay through the real resolver, real adapter, real validator

No model call. Loaded the two committed run artifacts verbatim
(`run-receipt.json`, `resolution.json` from
`evidence/canonical-v2/modiv-key-defined-terms-8.12-20260807-live/`),
rebuilt the exact `admitted_source_context` the original run used (same
committed raw HTML, same deal pin, independently re-verified
`canonical_text_sha256` against the pin), and called the real
`buildNativeWriteSet` + `validateResolvedCanonicalWriteSet` exactly as
`scripts/canonical-v2-live-extraction-run.mjs` does (`resolvedRunReceipt`
built the same way, `compiled_candidates` replaced with
`resolution.resolved`'s own `compiled_candidate`, matching the runner's own
Step 4 wiring).

**Before fix** (working tree at the commit that produced the committed
evidence): `candidates_written: 0`, `candidates_rejected_by_coordinate_shift:
10`, 10 residuals, all `EVIDENCE_SHIFT_TEXT_MISMATCH` — reproduces the
committed `adapter-result.json`'s counts exactly.

**After fix**: `candidates_written: 10`, `candidates_rejected_by_coordinate_shift:
0`, `residuals: 0`. `validateResolvedCanonicalWriteSet`'s
`publishableWriteSet.claims.length`: **0 → 10**. Every claim's role-tagged
evidence byte-verifies against the real document at document-absolute
coordinates (checked directly, not just trusted):

```
SUPERIOR_PROPOSAL_QUALIFIER          :: "would result in a transaction that is more favorable to the Company and its stockholders than the Company Merger"
INTERVENING_EVENT_EXCLUSION          :: "the receipt, existence of or terms of an Inquiry or Company Acquisition Proposal or any matter relating thereto or consequence thereof"
INTERVENING_EVENT_EXCLUSION          :: "changes in the market price or trading volume of the Company Common Shares or any other securities of the Company, or any change in credit rating of the Company or the fact that the Company meets or exceeds internal or published projections, budgets, forecasts or estimates of revenues, earnings or other financial results for any period"
KNOWLEDGE_STANDARD                   :: "the actual knowledge of such persons listed in Section 8.12(cc) of the Company Disclosure Letter"
KNOWLEDGE_PERSON_SOURCE              :: "such persons listed in Section 8.12(cc) of the Company Disclosure Letter"
KNOWLEDGE_STANDARD                   :: "the actual knowledge, after due inquiry of direct reports, of the persons listed in Schedule A hereto"
KNOWLEDGE_PERSON_SOURCE              :: "the persons listed in Schedule A hereto"
WILLFUL_BREACH_DEFINITION            :: "that the breaching party intentionally takes (or fails to take)"
WILLFUL_BREACH_KNOWLEDGE_STANDARD    :: "and actually knows that it would, or would reasonably be expected to, be or cause a material breach of this Agreement"
TAX_RETURN_DEFINITION_RECORDED       :: "including any information return, claim for refund, amended return or declaration of estimated Tax and including any schedule or attachment."
```

`accepted: true`, `quarantinedClosures: 0`. Nothing forced through: the
`open_world` count (2) and `review_queue` count (17) are untouched by this
fix, exactly as expected — this fix only concerns candidates the resolver
had already decided were governed.

## Hostile test — proves the fix discriminates, doesn't blanket-accept

`tests/canonical-v2-native-write-set-adapter.test.js`, two new tests:

1. `"a claim with a DEFINITION edge and an OPERATIVE_TEXT edge whose texts
   genuinely differ is published in full, not dropped"` — builds a
   two-role claim through the REAL `runNativeExtraction` (so
   `checkEvidenceScope` genuinely accepts it at compile time, the same gate
   production candidates pass through), then the real `buildNativeWriteSet`,
   and proves both edges shift to document-absolute coordinates and
   byte-verify against their own role-appropriate text.
2. `"hostile: a DEFINITION edge that does NOT reproduce its own
   definition_head_quote is still rejected, not forced through"` — takes
   that same real compiled candidate and corrupts the DEFINITION edge's
   offsets to point at real, in-bounds document text that is genuinely NOT
   this claim's `definition_head_quote` (the sibling OPERATIVE_TEXT span).
   Confirms the claim is still excluded, still recorded as a typed
   `EVIDENCE_COORDINATE_SHIFT_FAILED` residual with reason
   `EVIDENCE_SHIFT_TEXT_MISMATCH`, and that `expected`/`actual` on the
   residual are the role-correct values — proving the fix checks a real
   per-role invariant rather than skipping verification for `DEFINITION`
   edges.

Both new tests pass; the pre-existing 18 tests in the same file, plus
targeted runs of
`tests/canonical-v2-open-world-write-boundary.test.js`,
`tests/canonical-v2-open-world-serving-boundary.test.js`,
`tests/canonical-v2-conditional-fee-values-write-set-wiring.test.js`,
`tests/canonical-v2-component-rows.test.js`,
`tests/canonical-v2-provenance-tags.test.js`,
`tests/canonical-v2-candidate-resolution.test.js`,
`tests/canonical-v2-modiv-replay.test.js`,
`tests/canonical-v2-modiv-termination-fee-scope-correction-replay.test.js`,
`tests/canonical-v2-modiv-no-other-reps-answer-provenance-replay.test.js`,
`tests/canonical-v2-modiv-termination-fee-citation-following-replay.test.js`,
`tests/canonical-v2-f28-live-fixture-replay.test.js`,
`tests/canonical-v2-f28-second-live-fixture-replay.test.js` — all pass,
run with `CI=true`, output redirected to a file and grepped (never piped
into `head`/`tail`). The full suite was not run, per this task's
instructions; these are every test file that exercises
`native-write-set-adapter.js` or the `KEY_DEFINED_TERMS`/defined-term
resolution path.

## Verdict

**Ordinary defect, fixed.** Not a taxonomy gap, not a Step 3H question, not
a byte-offset bug, and Step 2A's pin fix stands — genuinely correct and
unrelated to this defect. Files touched: `lib/canonical-v2/native-producer/
native-write-set-adapter.js` (the fix + updated header comment) and
`tests/canonical-v2-native-write-set-adapter.test.js` (two new tests, both
listed above). No change to `candidate-resolution.js` — it was already
correct; the defect was entirely in the write-set adapter's post-shift
re-verification.

`evidence/canonical-v2/modiv-key-defined-terms-8.12-20260807-live/` was
left untouched (the committed run artifacts remain the historical "before"
record); the before/after numbers above come from a standalone replay
against those committed files plus the fixed module, not from re-running
the live extraction script or overwriting evidence.
