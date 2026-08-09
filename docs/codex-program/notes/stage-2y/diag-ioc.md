# IOC diagnostic — seven flagged INTERIM_OPERATING cards

Status: IN PROGRESS. Read-only investigation. Reading code via
`git show origin/cursor/step-2x-free-phase-b641:<path>` (branch not checked
out locally).

## Plan
1. Lead hypothesis: lowercasing of held quotes vs open-world quotes (cards
   #470/#471/#472) — locate where lowercasing happens (resolver vs renderer
   vs producer).
2. Corpus-wide count of held claims whose quote is not byte-verbatim in its
   section source.
3. Per-card diagnosis + fix.
4. Corpus counts per IOC reason code, ranked.

## Working log

### Lead hypothesis — VERDICT: cosmetic, in the renderer/reporting layer, not the resolver

Code path: `lib/canonical-v2/native-producer/ioc-mechanic-resolution.js`.

- The actual attachment/verification checks (`limbAttachment`, `parentAttachment`,
  `exactSectionOccurrence`, `componentText` equality, `numericResolution`) all
  operate on `item.raw_value` — the model's **original-case** extracted text —
  passed through unmodified from the producer's `open_world` array. Confirmed
  by reading `resolveIocMechanics()`: `attachmentResult = limbAttachment({
  mechanic, item, ... })` / `parentAttachment({ item, section, ... })`, both
  called before any lowercasing happens.
- The lowercasing happens exactly once, in `reviewItem()` (line 226):
  `normalised_phrase: item.raw_value.toLowerCase().replace(/\s+/g, ' ').trim()`.
  This is the **display-only field written into the persisted review-queue
  record for a HELD claim** — and `reviewItem()` does not even carry `raw_value`
  into that record, so the HELD review-queue entry has *no* original-case copy
  at all. The sibling `OPEN_WORLD` entry (built via `{ ...item, ... }` a few
  lines later in the same function) keeps `raw_value` untouched, which is why
  the flagged-cards.json pairs show lower vs. original case for the "same"
  text.
- Confirmed directly against `evidence/canonical-v2/concho-interim-operating-
  20260809-2xk-final/{resolution.json,review-queue.json}`: for every §6.1/§6.2
  OPEN_WORLD item I inspected, the `open_world` array's `raw_value` is
  original-case and the `review_queue` array's corresponding entry has no
  `raw_value`, only a lowercased `normalised_phrase`.
- **Blast radius: cosmetic only.** The checks are not weakened by this — a
  human reviewer looking at the HELD card just can't see the real casing of
  what was checked. No systemic quote-verification defect exists here.
  Spot-checked ~20 held IOC quotes across concho §6.1/§6.2 and metsera §5.01
  against the source `.htm`/canonical text: every `raw_value` used in a
  verification path was found byte-verbatim in its section. Zero holds are
  explained by a lowercase-vs-source mismatch.
- Separate, smaller finding worth a one-line fix: `reviewItem()` dropping
  `raw_value` means the persisted HELD record is *harder to audit* than it
  needs to be — worth adding `raw_value` back into the review-queue schema
  even though it isn't the cause of any of the seven cards.

### Card #467 — concho §6.2 — IOC_PARENT_ATTACHMENT_QUOTE_NOT_UNIQUE_IN_SECTION

Code: `ioc-mechanic-resolution.js` → `parentAttachment()` → `exactSectionOccurrence()`
(`sectionText.indexOf(quote)` must find exactly one hit in the whole section).

Source (byte offsets from `admitted_source_contexts[0].canonical_text`, §6.2 span
149982–157047): the phrase "until the earlier of the Effective Time and the
termination of this Agreement pursuant to Article VIII" occurs **twice** inside
§6.2 — once opening Parent's affirmative "ordinary course" covenant ("Parent
covenants and agrees that, until the earlier of…, it shall…") and once opening
the enumerated negative-covenant list ("…, until the earlier of…, Parent shall
not, and shall not permit its Subsidiaries…"). This is genuine, correct
boilerplate duplication — Ben is right. The producer even proposed it as two
distinct mechanics with two distinct `why_unmapped` labels ("period for the
affirmative covenant" vs. "period for the listed restrictions"), i.e. it
already knows these are different attachments.

Bug found in the evidence-citation step, not in `exactSectionOccurrence`
itself: both mechanics' `evidence[0]` cites the **same** `absolute_start:914,
absolute_end:1016` span (the *first* occurrence) even though the second
mechanic's own text is drawn from the second occurrence at ~1915. So whatever
locates a claim's source span for citation purposes is doing a first-match
`indexOf`, not disambiguating by which occurrence the model actually meant.

Diagnosis: `exactSectionOccurrence`'s "must occur exactly once in the section"
rule is too blunt for legitimate duplicate boilerplate. Fix should disambiguate
by **position** — use each claim's own evidence span (already captured) to
verify "the quote appears at *this* byte range" rather than "the quote appears
exactly once anywhere in the section". That also requires fixing the
evidence-span citation step to record the correct (second) occurrence instead
of always the first `indexOf` hit. Both are resolver/citation-side, no digest
invalidation — but the evidence-span bug needs finding and fixing first, or
positional disambiguation will silently mis-point one of the two claims.

### Card #470 — concho §6.2 — IOC_ATTACHMENT_TARGET_QUOTE_MISSING

Code: `limbAttachment()` — fires when `mechanic.target_restriction_quote` is
not a non-empty string. Confirmed in `resolution.json`'s `open_world` entry for
this item: `attachment_scope: "RESTRICTION_LIMB"`, `target_restriction_quote:
null`, `unverified_operand_fields: ["target_restriction_quote"]`.

Source: §6.2(b)(iii) — "amend or propose to amend Parent's Organizational
Documents (**other than in immaterial respects**) or adopt any material
change…". Confirmed: `ioc_restriction_components` already contains this exact
limb as a single `RESTRICTED_ACTION` component (byte range 154140–154493,
text starting "amend or propose to amend Parent's Organizational Documents
(other than in immaterial respects) or adopt any material change…") — i.e.
the qualifier's own extracted text is a **substring of an already-resolved
restriction component**. The host limb exists and is resolved; the producer
just didn't supply the limb's full quote as `target_restriction_quote`.

The producer prompt (`ioc-producer-prompt.js` line 56) instructs: "If you
cannot identify one exact target, keep attachment_scope and
target_restriction_quote null." The model set `attachment_scope:
RESTRICTION_LIMB` (it does know the target) but left the quote null — most
likely because the qualifier is a **parenthetical embedded inside the very
sentence it modifies** rather than a separately-quotable clause, and the
prompt's "never duplicate one qualifier at both levels" instruction may read
as forbidding a self-inclusive quote.

Fix (resolver-side, free, replay-validatable, no digest invalidation): in
`limbAttachment()`, when `target_restriction_quote` is missing/empty but
`attachment_scope === 'RESTRICTION_LIMB'`, fall back to searching
`components` in the same section for the one component whose `componentText`
**contains** `item.raw_value` as an exact substring (today it requires exact
equality). If exactly one match, resolve to it; otherwise keep the review
flag. This is deterministic over data already computed and requires no
re-prompting.

### Card #471 — concho §6.1 — IOC_PARENT_ATTACHMENT_SCOPE_UNCORROBORATED

Code: `parentAttachment()` → after `exactSectionOccurrence` passes (this
chapeau is unique in §6.1), `parentWideLanguage(quote)` must match one of four
literal phrase families: "nothing in this Section", "notwithstanding anything
to the contrary in this Section", "any/all of the foregoing", "anything set
forth or described in this Section". None of these appear in the actual
chapeau.

Source: §6.1 opens (byte offset 56 within the section, i.e. the very first
substantive text, immediately after the "6.1 Conduct of Company Business…"
heading) with "**Except (i)** as set forth on Schedule 6.1(a)…, (ii)…, (iii)…,
(iv)…, or **(v)** otherwise consented to by Parent in writing…" — the standard
enumerated-exceptions chapeau that precedes and governs everything that
follows in the section (both the affirmative "shall" covenant and, via a
second near-identical "Except (i)…(iv)" chapeau, the negative "(b)" list).
This exact idiom recurs for §6.1(b) and for both halves of §6.2 — it is the
single most common ALL_ITEMS-governing chapeau shape in this document, and
`parentWideLanguage()`'s vocabulary simply doesn't include it.

Diagnosis: vocabulary gap, not a genuine ambiguity — this is textbook
chapeau language, just not one of the four hard-coded marker phrases.

Fix: extend `parentWideLanguage()` (or better, replace the free-text match
with the structural chapeau detection the codebase already has —
`findIocChapeau` in `lib/canonical-v2/native-producer/candidate-resolution.js`
locates chapeaux structurally via section-relative regex+position rather than
literal marker phrases; that pattern, not a new literal string, is the right
model to extend for "Except (i)…(v)…, [Party] shall not / covenants and
agrees" chapeau recognition). Resolver-side, free, no digest invalidation —
this is a text-classification function over already-recorded quotes.

### Card #472 — concho §6.1 — IOC_ATTACHMENT_TARGET_QUOTE_MISSING + IOC_NUMERIC_OPERAND_NOT_EXACT

This is the deepest one — a real three-stage cascade, and Ben's "compounding
error, almost a limb issue" instinct is exactly right.

1. **Root cause**: the host limb is §6.1(b)(xiii): "waive, release, assign,
   settle or compromise… any Proceeding (excluding any audit, claim or other
   proceeding in respect of Taxes) other than (A) the settlement of such
   proceedings involving only the payment of monetary damages… not exceeding
   $10,000,000 in the aggregate and (B)…; provided, that the Company shall be
   permitted to settle any Transaction **Litigation**…". The
   `NATIVE_IOC_RESTRICTION_CANDIDATE` extracted for this limb has `raw_value`
   truncated to just "waive, release, assign, settle or compromise or offer or
   propose to waive, release, assign, settle or compromise, any Proceeding" —
   it does not include the trailing "…Transaction Litigation…" text. Verified:
   `CATEGORY_TESTS.LITIGATION_SETTLEMENTS` requires `/\b(settle|compromise)\b/i`
   **AND** `/\bActions?\b/` co-occurring in the same string (or the literal
   word "litigation"/"waive any claims"). The truncated quote has
   settle/compromise but neither "Action" nor "litigation" — so it fails
   corroboration with `CATEGORY_UNCORROBORATED` (visible in the same
   review-queue as source_citation `6.1(b)(xiii)`).
2. **Consequence**: because the limb never resolves to `IOC_RESTRICTION_PRESENT`,
   there is no `ioc_restriction_component` for it — confirmed: none of the 18
   restriction components in this document's `ioc_restriction_components`
   cover the litigation-settlement limb (there's a gap in the byte ranges
   right where it should be, between the debt limb at 146633–146726 and the
   capex limb at 149068–149190).
3. **Consequence**: the qualifier's own OPEN_WORLD mechanic
   ("other than (A) the settlement…$10,000,000…") requests
   `attachment_scope: RESTRICTION_LIMB` but has nothing to attach to, so
   `target_restriction_quote` is null and `unverified_operand_fields:
   ["target_restriction_quote"]` → `IOC_ATTACHMENT_TARGET_QUOTE_MISSING`.
4. **The numeric failure is not independent** — verified in code:
   `numericResolution()`'s first branch is
   `if ((mechanic.unverified_operand_fields || []).length > 0) return {...
   reason: 'IOC_NUMERIC_OPERAND_NOT_EXACT' ...}` — it fires on **any**
   unverified operand field, including `target_restriction_quote`, which is
   an attachment concern, not a numeric one. The actual numeric value,
   "$10,000,000", is present verbatim in the quote and would parse cleanly
   (`parseThresholdAmount` on both the quote and `value_literal:
   "$10,000,000"` would agree) — the gate never gets that far because it
   short-circuits on the unrelated field.
   **Corpus-wide confirmation**: every one of the 27 `IOC_NUMERIC_OPERAND_
   NOT_EXACT` holds across all 7 deals' latest interim-operating runs
   co-occurs with `IOC_ATTACHMENT_TARGET_QUOTE_MISSING` on the same claim —
   zero independent occurrences. This reason code never fires on its own.

Fixes (both resolver-side, free, no digest invalidation):
- `CATEGORY_TESTS.LITIGATION_SETTLEMENTS` in `ioc-corroboration.js`: add
  `/\bProceedings?\b/` alongside `/\bActions?\b/` as an acceptable object noun.
- `numericResolution()` in `ioc-mechanic-resolution.js`: only gate on operand
  fields relevant to the numeric parse (`value_literal`, `unit_literal`,
  `basis_literal`, `period_literal`); ignore `target_restriction_quote`
  (an attachment field) when deciding `IOC_NUMERIC_OPERAND_NOT_EXACT`.
- Once the category fix lands and the limb resolves, item 3 (attachment) also
  clears on replay without any further change — the whole cascade unwinds
  from the root cause.

### Cards #529 / #530 / #556 — metsera §5.01 — category vocabulary

Code: `lib/canonical-v2/native-producer/ioc-corroboration.js`,
`corroborateRestrictionCategory()` + `CATEGORY_TESTS`. Ran `categoryMatches()`
directly against the three quotes (node, module loaded standalone):

```
#529 "make (other than in the ordinary course of business consistent with
      past practice), change or revoke any material Tax election"
     -> [ 'OTHER_ORDINARY_COURSE', 'TAX_ELECTIONS' ]   (2 matches -> AMBIGUOUS)

#530 "repurchase, redeem or otherwise acquire any Company Securities or
      Company Subsidiary Securities"
     -> [ ]                                             (0 matches -> UNCORROBORATED)

#556 "sell, transfer, lease (as lessor), license, abandon or otherwise
      dispose of (...), or pledge, assign, exchange, encumber or otherwise
      subject to any Lien (...), any material properties or assets ...
      (including Company Controlled Intellectual Property)"
     -> [ 'IP_LICENSING', 'LIENS_ENCUMBRANCES' ]        (2 matches -> AMBIGUOUS,
                                                          correct category
                                                          DISPOSITIONS_ASSET_SALES
                                                          never matches at all)
```

The taxonomy **is** being consulted (Ben's "did the taxonomy not come in?" —
no, it came in; it's just wrong on these shapes). Three distinct vocabulary
bugs, not one:

- **#529**: `OTHER_ORDINARY_COURSE` is `/\bordinary course\b/i` with no
  awareness of parenthetical/negating context — it fires on "(other than in
  the ordinary course…)" inside an unrelated Tax-election limb, purely
  because the substring "ordinary course" appears anywhere. Needs a negative
  lookbehind/parenthetical-exclusion, or restrict the test to unparenthesized
  "ordinary course" occurrences.
- **#530**: `EQUITY_REPURCHASES` requires the literal word "shares"
  (`/\brepurchase.*shares?\b/i`, `/\bredeem.*shares?\b/i`) but this corpus's
  drafting uses the defined term "Securities" instead. Not the
  `LEGACY_RESTRICTION_CATEGORY_ALIASES`/pinned-quote issue the task flagged
  as a hypothesis for MERGE/COMP — the asserted category here is the
  canonical `EQUITY_REPURCHASES` key directly, no alias involved. Fix: widen
  the regex to `/\b(repurchase|redeem).*(shares?|securities)\b/i` (or match
  against "Company Securities"/"Subsidiary Securities" explicitly).
- **#556**: `DISPOSITIONS_ASSET_SALES` requires the literal noun phrases
  "disposition(s)"/"asset sale(s)" or the *exact* word order "transfer, sell,
  lease" — this corpus's drafting says "sell, transfer, lease" (reordered).
  None of the three DISPOSITIONS_ASSET_SALES patterns match, so the correct
  category never enters `matches` at all, while two incidental words inside
  the same long limb — "Lien" (in "any Lien (other than a Permitted Lien)")
  and "Intellectual Property" / "license" (in "including Company Controlled
  Intellectual Property") — spuriously trip `LIENS_ENCUMBRANCES` and
  `IP_LICENSING`. Fix: loosen `DISPOSITIONS_ASSET_SALES` to match "sell,
  transfer" in either order and add "dispose of"/"disposal" as an
  alternative to "disposition(s)".
- **#556 duplicate-claims sub-question**: confirmed from `resolution.json` —
  4 separate `review_queue` entries all cite `source_citation: "5.01(g)"`
  with byte-identical `raw_value` but 4 **different**
  `original_claim_occurrence_id`/`closure_id` values. This is **one
  restriction limb (5.01(g)) proposed as a duplicate candidate four times**
  by the native producer, not four genuinely different restrictions sharing
  a span. Worth a separate look at candidate de-duplication in the
  restriction-candidate emission step, though it's outside this diagnostic's
  seven reason codes.

### Corpus-wide reason-code counts (holds), latest run per deal

7 deals, latest `*-2xk-final`/`*-2xk-r3(-final)` interim-operating run each:
concho, metsera, modiv, redhat, skechers, skywater, topbuild.
226 HELD review-queue items total (of 344 candidates scanned; 118 resolved
clean with no reason). 27 items carry two reason codes — **all 27** are the
`IOC_ATTACHMENT_TARGET_QUOTE_MISSING` + `IOC_NUMERIC_OPERAND_NOT_EXACT` pair
diagnosed in #472 above; that pairing is the only multi-reason combination
anywhere in the corpus.

Ranked by volume:

| # | reason code | count |
|---|---|---|
| 1 | CATEGORY_UNCORROBORATED | 78 |
| 2 | IOC_ATTACHMENT_TARGET_QUOTE_MISSING | 64 |
| 3 | AMBIGUOUS_CATEGORY_CORROBORATION | 39 |
| 4 | IOC_PARENT_ATTACHMENT_SCOPE_UNCORROBORATED | 30 |
| 5 | IOC_NUMERIC_OPERAND_NOT_EXACT | 27 (100% co-occurs with #2) |
| 6 | LEXICAL_UNMATCHED_SIGNAL_IN_SCOPE | 9 |
| 7 | IOC_ATTACHMENT_TARGET_ZERO_MATCHES | 4 |
| 8 | IOC_PARENT_ATTACHMENT_QUOTE_NOT_UNIQUE_IN_SECTION | 2 |

Fix-order implication: the category-vocabulary fixes (#1 + #3 = 117 holds,
54% of all held claims) and the `target_restriction_quote` substring-fallback
+ numeric-gate fix (#2 + #5 = 91 holds, 41%, largely overlapping) together
account for the great majority of the corpus. `IOC_PARENT_ATTACHMENT_SCOPE_
UNCORROBORATED` (30, #4) is the `parentWideLanguage()` chapeau-vocabulary gap
from #471, present in every deal that uses the "Except (i)…" idiom (concho,
modiv, redhat, skechers, skywater, topbuild — 6 of 7).

## Status: COMPLETE

