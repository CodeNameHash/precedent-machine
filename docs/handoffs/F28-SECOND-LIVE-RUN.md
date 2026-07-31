# F28 — second live end-to-end native extraction run (PROMPT_VERSION 2)

Direct comparison to `docs/handoffs/F28-FIRST-LIVE-RUN.md`, same filing, same
governed section, same pipeline stages, after: HTML entity decoding fixed
(`&lrm;`/`&nbsp;`/`&#8239;` etc. now decode to real codepoints; canonical
text is faithful, matching is tolerant via
`lib/canonical-v2/zero-width-normalise.js`), PROMPT_VERSION 2 (`limb_path`
arrays, one `representation_instance` per governing section, `attachment`
objects, code-computed `scope_reading`), citation constructibility checking
(`native-producer/citation-constructibility.js`), and kind-aware mapping in
`candidate-resolution.js`.

Recorded fixture: `tests/fixtures/canonical-v2/f28-second-live-run/qxo-topbuild-3-1-b-live-response.json`
Script: `scripts/canonical-v2-f28-second-live-extraction-run.mjs`

**Headline result: PROMPT_VERSION 2 fixed both structural defects run 1
found (fragmentation, limb-qualifier misattachment) but a NEW, more severe
defect fully replaced them as the pipeline's bottleneck: the citation-
constructibility gate rejects the model's citation for 100% of proposals
(23/23), so zero candidates reach compilation. Run 1 produced 33 compiled
candidates (0 published); run 2 produces 0 compiled candidates (0
published). The extraction itself is better; the end-to-end throughput is
worse.**

## Step 1 — source

Identical filing to run 1, re-fetched and re-verified independently:

- EDGAR URL: `https://www.sec.gov/Archives/edgar/data/1236275/000110465926045111/tm2612209d1_ex2-1.htm`
- Raw bytes: **732,686 bytes**, SHA-256
  `146189ed57883d25aa571650fe5c40dff4bfce0e3ea75d67be463440417bda3f` —
  matches the task's pinned value exactly.

## Step 2 — conversion and sectionizing

`convertSecHtmlToCanonicalText` → `verifySecHtmlCanonicalText`: **PASS**.

| | Run 1 | Run 2 |
|---|---|---|
| canonical_text byte length | 413,966 | **412,860** |
| canonical_text sha256 | `6f7f30b32c00c1d8acf3524594a3565306ed16f022dd13dda8150ca8d6541a1c` | `7dfbb5bb90fa7034462e42496e9a5068fa2fa6ac55ba69f977cf7108378e7f5d` |
| verification_status | PASS | **PASS** |
| sectionizer node count | 338 | **338** (identical: 1 ROOT, 8 ARTICLE, 8 SECTION, 321 SUBSECTION) |
| literal `"&lrm;"` string in canonical text | present (undecoded bug) | **absent** — decodes to real U+200E (547 occurrences) |
| literal `"Section 3.1"` (byte match) | 0 | **0** (unchanged) |
| `"Section 3.1"` under zero-width-tolerant matching | not measured in run 1 | **29** |

The canonical text shrank by 1,106 bytes: `&lrm;` used to survive as the
5-byte literal string `"&lrm;"` (the bug); it now decodes to the 3-byte
UTF-8 encoding of U+200E, one byte shorter per occurrence, times ~547
occurrences (with other entity-table corrections contributing the rest).

**The entity fix is confirmed working, but it does NOT create new
"Section 3.1" headings and was never going to.** Literal byte-for-byte
`"Section 3.1"` is still 0 occurrences — searching for it naively (as I
initially did) is the wrong test, and gets the wrong answer for the wrong
reason. The real story, found by using `zero-width-normalise.js` the way
the matching layer is designed to be used: every genuine `"Section
3.1(b)(i)"`-style cross-reference in this document has a real, decoded
U+200E LEFT-TO-RIGHT MARK sitting between `"Section "` and `"3.1"` (EDGAR's
own bidi-rendering markup), so a literal match will *never* find it and was
never supposed to — that is exactly why `zero-width-normalise.js` exists
("matching is tolerant"). Once zero-width marks are stripped for comparison
purposes only, `"Section 3.1"` appears **29 times**, all as cross-reference
prose. This confirms the two-layer design (`sec-html-canonical-text.js`
decodes and keeps; `zero-width-normalise.js` normalises only for matching)
is working correctly end to end on this real document — a positive, if
narrow, result for Step 2.

**`sectionizeAdmittedSource` still finds ZERO numeric section nodes**
(references matching `^\d+\.\d+`) — same as run 1, and correctly so: this
is a structural fact about how QXO/TopBuild's Article III is drafted (bare
lettered subsections `(a)`–`(s)` directly under the ARTICLE heading, no
`"Section 3.1"` *heading* anywhere in the document), independent of the
entity bug and not something an entity-decoding fix could ever have
changed. `III-INTRO(b)` still resolves (now at bytes `[57763, 62446)`,
shifted from run 1's `[57875, 62564)` by the byte-length change above), and
its content is unchanged: `"(b) Capital Structure.\n(i) The authorized
capital stock of the Company consists of..."`. **This structural fact is
exactly what makes the new citation-constructibility defect (below)
possible: the sectionizer's own tree never independently discovers a
`"3.1(b)"`-shaped reference, even though that exact string appears as real,
printed cross-reference prose inside the governed section itself.**

## Step 3 — live extraction run

**No `ANTHROPIC_API_KEY` available** (confirmed before starting). Used the
identical `claude -p` CLI backend run 1 used, injected through
`createAnthropicProvider`'s `client` seam, via a new driver script
(`scripts/canonical-v2-f28-second-live-extraction-run.mjs`, a copy of run
1's script that additionally records the raw response into the
`NATIVE_PRODUCER_RECORDED_RESPONSE/V1` fixture shape). Genuine live call,
served model Claude Sonnet 5.

| | Run 1 | Run 2 |
|---|---|---|
| Wall clock | 361.5s | **217.2s** |
| input_tokens (fresh) | 2 | 2 |
| cache_creation_input_tokens | 14,741 | 21,864 |
| cache_read_input_tokens | 29,457 | 23,684 |
| output_tokens (CLI-billed, incl. invisible thinking) | 43,101 | 25,609 |
| CLI-reported cost | $0.7477 (Sonnet $0.7438 + Haiku $0.0035) | **$0.5268** (Sonnet $0.5224 + Haiku $0.0044) |
| Actual prompt built (chars / ~tokens) | 11,379 / ~2,845 | **14,878 / ~3,720** (PROMPT_VERSION 2 is a longer prompt: worked example + attachment schema) |
| Visible JSON answer (chars / ~tokens) | 19,470 / ~4,868 | **11,785 / ~2,946** (materially shorter — see quality assessment, defect 2 below) |
| Metered-API-equivalent estimate (`$3`/`$15` per MTok, no thinking) | ~$0.08/section | **~$0.011 + $0.044 ≈ $0.055/section** |

Run 2 was faster and cheaper in both CLI-billed and metered-equivalent
terms, but the cheaper output is not simply "more efficient" — see quality
finding 2 below: the shorter answer reflects materially less qualifier
decomposition, not just less repetition from fragmentation.

## Step 4 — resolve, write, validate

| Stage | Run 1 | Run 2 |
|---|---|---|
| Compiled candidates (native-extraction-run) | 33 ok / 0 rejected | **0 ok / 0 rejected** |
| Producer evidence_residuals | 0 | **0** |
| Scope violations | 0 | **0** |
| **Citation residuals** | not checked (feature didn't exist yet) | **23 / 23 proposals — 100% `CITATION_NOT_CONSTRUCTIBLE`, 0 `AGREEMENT`, 0 `CITATION_DISAGREEMENT`** |
| resolveCandidates: resolved | 15 | **0** |
| resolveCandidates: review_queue | 15 | **0** |
| resolveCandidates: open_world | 18 | **0** |
| buildNativeWriteSet: claims written | 15 | **0** |
| validateResolvedCanonicalWriteSet: accepted | true | **true (trivially — empty write set)** |
| validateResolvedCanonicalWriteSet: quarantines | 15 | **0** |
| **Publishable claims** | **0** | **0** |

Every one of the 23 proposals this run produced (21 limb assertions + 2
qualifiers, exactly matching the single representation's own limb/qualifier
count) was rejected at the citation-constructibility gate, inside
`runNativeExtraction`, *before* `compileCandidateProposals` ever ran. That
means `resolveCandidates`, `buildNativeWriteSet` and
`validateResolvedCanonicalWriteSet` all executed successfully on an empty
input — every "0" in the Run 2 column above is trivially true, not a
meaningful pass. Both runs land at 0 publishable claims, for two entirely
different reasons: run 1 by the qualifier-kind quarantine bug (now fixed);
run 2 by a new upstream gate that fires before resolution is ever reached.

## Step 5 — THE COMPARISON: run 1's four defects

### Defect 1 — fragmentation into twelve `representation_instances`: **FIXED**

Run 2 emits **exactly one** `representation_instance` for the governed
section, with **21 limbs**, every one using a correctly nested `limb_path`
array traced from the representation root — e.g. `["(ii)","(A)"]`,
`["(iii)","(C)"]` — never a bare flat label colliding across unrelated
parents. Compare run 1's 12 fragments with reused flat labels (`"(i)"` used
in 3 different pseudo-representations). Sample from the fixture:

```
limb_path: ["(i)"]        -> "The authorized capital stock of the Company consists of"
limb_path: ["(i)","(A)"]  -> "250,000,000 Company Shares, of which 28,142,327 ... outstanding ..."
limb_path: ["(i)","(B)"]  -> "10,000,000 shares of preferred stock ..."
limb_path: ["(ii)","(A)"] -> "54,756 Company Shares were issuable upon the exercise of Company Options ..."
limb_path: ["(iii)","(B)"]-> "preemptive or other outstanding rights, options, warrants ..."
limb_path: ["(iv)"]       -> "Upon any issuance of any Company Shares ... duly authorized ..."
limb_path: ["(v)"]        -> "There are no voting trusts ..."
```

The worked example in PROMPT_VERSION 2's instructions (nested limbs stay in
ONE representation) was followed exactly, including for the deepest nesting
level the document actually has (`(iii)` containing `(A)`/`(B)`/`(C)`).

### Defect 2 — the one genuine limb-level materiality qualifier attached at REPRESENTATION instead of LIMB: **FIXED**

```json
{
  "kind": "THRESHOLD",
  "code": null,
  "quote": "with a fair market value that is material to the Company and its Subsidiaries, taken as a whole",
  "attachment": {
    "position": "ITEM",
    "governs_path": ["(iv)"],
    "ambiguity_signals": { "items_grammatically_parallel": false }
  }
}
```

`position: "ITEM"` with `governs_path: ["(iv)"]` is exactly limb-level
attachment — the defect this feature was purpose-built to fix. Confirmed
structurally correct independent of the citation-gate issue below (the
attachment computation happens inside `anthropic-provider.js`/
`qualifier-attachment.js`, upstream of and unrelated to the citation check).

**New wrinkle exposed by having two independent live runs of the same
clause to compare, not itself a PROMPT_VERSION 2 defect:** run 1 coded this
qualifier `kind: "ACCURACY", code: "MAT_MATERIAL_INLINE"`; run 2 coded the
*identical clause* `kind: "THRESHOLD", code: null`. Under
`candidate-resolution.js`'s fixed kind-aware table, these two codings
resolve completely differently — `ACCURACY` attempts
`REPRESENTATION_ACCURACY_STANDARD` resolution, `THRESHOLD` correctly routes
straight to open-world. The model's own qualifier-kind classification is
not stable run-to-run for the same text. Nothing in this pipeline currently
tests or normalises that instability.

### Defect 3 — misattributed/"hallucinated" citations (e.g. `"3.1(b)(i)"`): **RETRACTED PREMISE CONFIRMED, BUT A NEW AND MORE SEVERE DEFECT TAKES ITS PLACE**

Per the task brief: run 1's "hallucinated citation" conclusion was wrong —
the model was quoting the entity-corrupted text faithfully; our converter
had corrupted it. Run 2 confirms this directly: the governed section text
now (correctly) contains the literal, decoded string `"Section 3.1(b)(ii)"`
and `"Sections 3.1(b)(i) and 3.1(b)(ii)"` as real in-scope cross-reference
prose (verified against the exact bytes shown to the model). The model's
single `section_reference: "3.1(b)"` for the whole representation is
**grounded in real, printed, in-scope text** — not invented, and consistent
with how the rest of the agreement (the Section 5.2(a)(ii) bring-down
condition) refers to this same representation. By any human legal-reading
standard this is the *correct* citation, arguably the most externally
consistent one available.

**But it is not `CITATION_CONSTRUCTIBLE`.** Citation-check outcome across
all 23 proposals: **23 `CITATION_NOT_CONSTRUCTIBLE`, 0 `AGREEMENT`, 0
`CITATION_DISAGREEMENT`.** `citation-constructibility.js` derives its
authoritative citation purely from the sectionizer's own tree, and (per
Step 2) that tree only ever discovers this section as `"III-INTRO(b)"` —
its synthetic fallback address, because this document's actual headings
never spell out `"Section 3.1"` anywhere the sectionizer's heading-detection
walks over. `"3.1(b)"` never appears as any `node.reference` in the tree,
so `checkCitationConstructibility` cannot resolve it to any node at all,
regardless of how correct or well-grounded it is. **Result: 100% of the
run's output — the correctly-fragmented, correctly-attached extraction from
defects 1 and 2 — is discarded before compilation.** This is a NEW, more
severe defect than the one it replaced: run 1's citation problem was
metadata noise the pipeline had no way to *detect*; run 2's is a total
throughput blocker the pipeline actively *enforces*, on a document where the
model did nothing wrong. The gate's design assumption — "every discovered
[sectionizer] reference is itself built by exactly that same
parent-reference-plus-own-label concatenation, [so] an exact match ... IS a
proof" — is true of the sectionizer's own internal consistency, but doesn't
hold as a completeness claim: a document can have a real, external,
cross-reference-consistent numbering scheme that the sectionizer's
heading-only discovery never sees.

**This is not a coding bug — it's a known, deliberately tested design
choice whose real-world blast radius nobody had measured until this run.**
`tests/canonical-v2-citation-constructibility.test.js` already has a test
titled *"a '3.1(b)(i)'-style citation is CITATION_NOT_CONSTRUCTIBLE against
a document with no decimal section numbering at all"* asserting exactly
this outcome as correct. That unit test is right in isolation — a single
mismatched citation genuinely should not be silently accepted. What the
unit test could not show, because it only checks one citation against a
synthetic tree, is what happens when *every single proposal* a real,
common drafting style (bare lettered subsections directly under a Roman-
numeral Article, no decimal `"Section 3.1"` heading anywhere — confirmed
common enough to be QXO/TopBuild's actual convention) produces the same
"correct but not constructible" citation: the entire section's extraction
output, 23/23 proposals, is discarded. The design choice was reasonable
per-citation; its consequence at whole-document scale, on real filings that
use this drafting convention, was not visible until today.

### Defect 4 — all resolvable claims quarantined as accuracy claims (TEMPORAL/THRESHOLD never publishable): **FIX PRESENT IN CODE, NOT EXERCISED LIVE THIS RUN**

Confirmed by static read of `candidate-resolution.js`:
`GENERIC_CLAIM_KEY_RESOLUTION_TABLE` is now keyed on `(generic_claim_key,
qualifier_kind)`, not `generic_claim_key` alone. Only `(QUALIFIER_CLAIM_KEY,
'ACCURACY')` maps to `REPRESENTATION_ACCURACY_STANDARD`;
`KNOWLEDGE`/`THRESHOLD`/`TEMPORAL` are deliberately absent and fall through
to open-world (`UNMAPPED_GENERIC_CLAIM_KEY`) rather than being force-mapped
and then quarantined. This is exactly the fix the defect called for.

**It could not be exercised end-to-end in this run**, because defect 3's
citation gate rejected all 23 proposals before any of them reached
`resolveCandidates` — `resolution.json` is empty (`resolved: 0,
review_queue: 0, open_world: 0, residuals: 0`). Whether the fix behaves
correctly against real TEMPORAL/THRESHOLD qualifiers from this document
remains unverified by live data; it is only verified by code inspection and
(presumably) unit tests. **The most valuable next live run is the same
call with the citation-constructibility gate either fixed or bypassed, so
defect 4's fix finally gets to run against real qualifiers.**

## Step 6 — honest quality assessment

### What it got right

- **Structural fragmentation is genuinely fixed.** One representation, 21
  correctly-nested limbs, zero label collisions, matching the prompt's own
  worked example exactly — including at the deepest nesting level the
  document actually has.
- **The one true limb-level qualifier landed at the right level**, with the
  right `governs_path`.
- **Evidence quotes remain byte-exact.** 0 evidence_residuals, 0
  scope_violations across all 23 proposals — quote fidelity held up under a
  substantially heavier prompt (worked example, attachment schema,
  controlled vocabularies) without degrading.
- **Coverage is still complete.** Every substantive element from run 1's
  list is still present in this run's 21 limbs — nothing from the governed
  scope was skipped.
- **The citation is arguably more honest than run 1's**, in that it's
  grounded in real in-scope text rather than a per-limb invented-looking
  decimal.

### What it got wrong (new defects, not present or not visible in run 1)

1. **Citation-constructibility total blockage — the headline defect.** See
   defect 3 above. 100% pipeline rejection on real data, zero compiled
   candidates. This is worse for actual usability than run 1's outcome (33
   compiled candidates, all eventually unpublished, vs. 0 compiled
   candidates full stop) even though the underlying extraction is
   qualitatively better. A downstream reviewer gets literally nothing to
   look at from this run, where run 1 at least surfaced a review queue.
2. **Qualifier decomposition regressed materially.** Run 1 pulled out
   roughly a dozen distinct qualifier objects (TEMPORAL dates, THRESHOLD
   carve-outs, the ACCURACY "correct and complete" tag, the materiality
   qualifier). Run 2 pulls out only **2**. The rest — "as of the close of
   business on April 17, 2026" (limb `(i)(A)`), "as of the date hereof"
   (`(i)(B)`), "As of April 17, 2026" (chapeau text folded into `(ii)`),
   "(assuming achievement of the applicable performance goals at the target
   level)" (`(ii)(C)`), "correct and complete" (`(ii)`'s Disclosure Letter
   clause), "(other than restrictions on transfer arising under applicable
   securities Laws)" (`(ii)`), "Except for any obligations pursuant to this
   Agreement, or as set forth in Sections 3.1(b)(i) and (ii)" (`(iii)`),
   "Except as set forth above" (`(iv)`) — are all still present, but buried
   as unstructured prose inside each limb's `assertion_quote` rather than
   pulled out as separate, queryable qualifier objects. Nothing was
   silently dropped from the underlying text, but the granularity a
   reviewer or downstream query needs (filter by qualifier kind, check
   attachment scope) is gone for roughly 10 of the ~12 qualifiers a careful
   read of the source would flag. This directly explains most of the
   output-token/cost drop in Step 3 — it is not free efficiency.
3. **Qualifier-kind classification is unstable run-to-run** for the one
   qualifier both runs agree on extracting (see defect 2). A downstream
   resolution outcome now depends on which run happened to produce the
   response, with no mechanism in this pipeline to catch or flag the
   disagreement.
4. **`chapeau_quote` is `null`** even though limb `(i)`'s own sentence
   plausibly functions as an implicit chapeau to its own sub-limbs `(A)`/
   `(B)`. Defensible (the model instead nested it as `limb_path: ["(i)"]`,
   which is not obviously wrong for a document whose real chapeau —
   `"(b) Capital Structure."` — carries no content), but worth noting as a
   field the schema offers that this run chose not to use at all.

### What it missed

Nothing new inside the governed scope — same completeness as run 1. What a
lawyer would still want and this run structurally cannot supply (same as
run 1, unchanged, out of scope by design): the Section 5.2(a)(ii) bring-down
carve-out and the Titanium Merger Sub capitalisation representation.

## Step 7 — qualifier-attachment.js: TRAILING resolution

**No `TRAILING`-position qualifier appeared in this run.** Both of run 2's
two qualifiers report `position: "ITEM"`. `qualifier-attachment.js`'s
lexical marker test (`SERIES_MARKER_PATTERNS` / `SINGLE_CLAUSE_MARKER_
PATTERNS` against `AMBIGUOUS`/`ALL_ITEMS`/`THIS_ITEM_ONLY`) was therefore
not exercised by live model output in this run — it remains verified only
by its own unit tests (`tests/canonical-v2-qualifier-attachment.test.js` if
present) and by code inspection, not by a real TRAILING qualifier from this
filing. Section 3.1(b) genuinely has no obvious trailing-qualifier-after-a-
list construction in its own text (its qualifiers are threshold provisos
sitting inside single clauses, not clauses trailing an enumerated series),
so this may simply be the wrong provision to exercise that path with live
data — a different section (or the bring-down condition, out of scope here)
would be a better target for that specific check.

## Bottom line

PROMPT_VERSION 2 delivered on both of run 1's structural findings: no more
fragmentation, and the one real limb-level qualifier lands at the right
level. Model output quality, where it reached compilation, is genuinely
better than run 1's. But a new architecture-level gate —
citation-constructibility, built specifically to catch a *different*
problem run 1 (mistakenly) thought it had — turns out to reject correct,
well-grounded model output whenever a real document's headings don't
themselves spell out the decimal section number the document nonetheless
uses consistently in its own cross-reference prose. On this real filing
that is not a partial degradation: it is total. Zero compiled candidates,
zero publishable claims, on a run whose extraction is otherwise the best
this pipeline has produced to date. The next fix this feature needs is not
another producer-prompt iteration — it's making citation-constructibility
accept a citation the document's own text corroborates even when the
sectionizer's heading-only tree doesn't independently discover it, or
relaxing the gate so a `CITATION_NOT_CONSTRUCTIBLE` proposal is quarantined
for review rather than silently discarded pre-compilation the way
`scope_violations` already are.
