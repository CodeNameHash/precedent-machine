# Structural inheritance: diagnosis of the 96-card hold-backs

2026-08-08. Written against main at `ff08dd1e`, the eight termination evidence
runs under `evidence/canonical-v2/`, and the blind set in the session
scratchpad (`blind-key.json` / `blind-verdicts.json`). Every mechanism named
below was traced to the line that fires, not inferred from headers. No
production code touched.

---

## 1. Verdict on the thesis

**Ben is right that structural inheritance is the dominant failure — six of
the nine marked cards refuse because a fact the drafting puts in the
enclosing structure (section chapeau, limb head, host representation) is
demanded inside the candidate's own quote. But it is not one defect wearing
one coat. The nine cards split into three mechanically distinct classes, and
conflating them would fund the wrong fixes.**

- **Class A — structural context lost (6 of 9: cards 01, 03, 05, 08, 16, 70).**
  The corroborating fact (terminating party, condition obligor, exception
  scope, qualifier host) sits in the chapeau or host that the "smallest span,
  one legal fact" quoting rule excludes by construction. Crucially, the
  codebase already implements chapeau inheritance **four separate times, each
  partially**: `findTerminationGrantContext` / `findTerminationLimbGrantContext`
  (termination, two hard-coded chapeau grammars),
  `findIocChapeau` (IOC party), `qualifier-attachment.js` (position → scope,
  live in REPRESENTATIONS and CAPITALISATION), and the limb identity tree
  (`limb-components.js`). None of them covers the cases above. This is the
  repo's signature failure mode — rebuilding the same idea per family —
  caught mid-flight.

- **Class B — deterministic vocabulary gaps (cards 04, 06).** The quote is
  complete and self-contained; the fail-closed lexicon simply does not know
  the deal's surface form ("Organizational Documents" vs
  "certificate of incorporation/bylaws/governing documents"; "in any material
  respect" vs "in all material respects"). **This is the only class where
  Ben's offer of more approved phrases is the right lever.**

- **Class C — occurrence aliasing (card 15).** The machinery worked; the
  container handed to it was too coarse. The quote appears byte-identically
  twice inside "section" Annex-A (Company MAE and Parent MAE definitions),
  and the verifier correctly refuses to guess which occurrence the label
  denotes. Not an inheritance failure at all.

One additional class surfaced while answering Ben's termination question,
and it matters more than any single card:

- **Class D — structure-determined attributes gated on model whim.** Concho
  and SkyWater both emitted "by mutual written consent of the Company and
  Parent" with identical trigger and party fields; SkyWater's response
  happened to say `terminating_party_scope: "EITHER_PARTY"` and resolved,
  Concho's said `null` and fell to open world via `PARTY_SCOPE_OUT_OF_ENUM`
  (`candidate-resolution.js:9554`). Identical text, opposite outcome, decided
  by a model attribute the text itself determines (the resolver's own
  `TERMINATION_EITHER_PARTY_PATTERN` at line 3013 already fires on "mutual
  written consent" in both). This is the same disease as Class A in its purest
  form: asking the model for a fact the structure settles, then hard-gating
  on the answer.

---

## 2. Per-card mechanism table

| # | Card | Refusal | Actual mechanism (file:line) | Class |
|---|------|---------|------------------------------|-------|
| 01 | topbuild TERMINATION, injunction limb | TERMINATING_PARTY_REF_NOT_IN_QUOTE | Mutual grant "…by either Parent or the Company if" matches neither section-grant pattern (`by PARTY if`, single party only — `candidate-resolution.js:1634-1635`) nor limb pattern (`by either X, **on the one hand**, or Y…` — `:1692`). No rescue → party ref demanded in the limb quote (`:9490`). Still refused in `topbuild-termination-20260808-rung3`. | A |
| 03 | redhat REPRESENTATIONS, MAE chapeau qualifier | QUALIFIER_KIND_UNCLASSIFIED | No lexicon marker fires on "Except as would not reasonably be expected to have… a Material Adverse Effect" (the idiom is absent from `ACCURACY_PATTERNS`, `qualifier-kind-lexicon.js:171-176`; the whitelist knows it only as a suffix of "true and correct in all respects, except as…", `:229`). Empty family set + model hint ACCURACY → REVIEW (`:880-888`). The host words the whitelist needs live in a different structural slot. | A |
| 04 | concho INTERIM_OPERATING, amend org docs | CATEGORY_UNCORROBORATED | `CATEGORY_TESTS.CHARTER` (`ioc-corroboration.js:28`) matches "certificate of incorporation / bylaws / governing documents" — not Concho's defined term "Organizational Documents". Three sibling refusals in `concho-interim-operating-20260808-r1` for the same reason. Quote is complete; pure lexicon gap. | B |
| 05 | modiv TERMINATION, Outside Date | TERMINATING_PARTY_REF_NOT_IN_QUOTE | **Already fixed on main.** `fb7f1c64` (Aug 6, "corroborate a termination right against the limb that grants it") added the limb-chapeau fallback; `modiv-termination-20260807-replay` resolves this exact quote as both TERMINATION_RIGHT_GRANT and TERMINATION_OUTSIDE_DATE from byte-identical model output. The blind set predates the fix. | A (fixed) |
| 06 | redhat REPRESENTATIONS, "in any material respect" | QUALIFIER_KIND_UNCLASSIFIED | "in **any** material respect" matches no ACCURACY pattern ("in **all** material respects" does); empty family set + ACCURACY hint → REVIEW. Ben's verdict is NOISE standing alone — the gate held the right card, for the wrong reason. See section 3 for the deeper problem this row exposes. | B |
| 08 | skywater TERMINATION, Change in Recommendation | TERMINATING_PARTY_REF_NOT_IN_QUOTE | SkyWater's limb heads are "by either the Company or Parent:" and bare "by Parent:" — no "if", no "on the one hand". Both grant grammars miss. 8 of 9 SkyWater review rows carry this one reason. | A |
| 15 | skywater MAE_DEFINITION, economic-conditions carve-out | CLAUSE_LABEL_NOT_IN_QUOTE | The quote appears **twice** in the Annex-A span (Company MAE and Parent MAE carveout (A) are byte-identical — verified in the canonical text). `verifyMaeClauseLabelAdjacency` fails closed on a non-unique quote (`mae-clause-label-parse.js:76-78`); tier 3's only same-label sibling is the identical twin, which is filtered as `siblingQuote === quote`. The candidate's own `defined_term_ref` would disambiguate; nothing uses it to narrow the search span. 12 rows in `skywater-mae-definition-20260808-r1` die this way. | C |
| 16 | concho CLOSING_CONDITIONS, cap-structure bring-down | PARTY_UNRESOLVED | The obligor lives only in the §7.2 chapeau ("The obligations of Parent and Merger Sub… are subject to…", canonical text line 781). The prompt instructs `condition_obligor: <verbatim phrase>… otherwise null` — a bring-down limb has no obligor phrase, so the model correctly emits null, and `resolveParty(null)` refuses (`candidate-resolution.js:4737-4738`, `:1524-1525`). The refusal is the prompt and resolver jointly demanding the one thing the structure withholds. | A |
| 70 | skechers INTERIM_OPERATING, consent exception | IOC_PARENT_ATTACHMENT_SCOPE_UNCORROBORATED | `parentWideLanguage` (`ioc-mechanic-resolution.js:46-53`) requires section-wide scope to be *stated in the quote's words* ("nothing in this Section", "any of the foregoing"…). The Skechers exception's scope comes from its *position* in the §5.1 chapeau before the restriction list — exactly the positional fact `qualifier-attachment.js` was built to encode (CHAPEAU → ALL_ITEMS) and which this family never consults. | A |

---

## 3. Why the machinery failed where it already exists (cards 15, 03/06)

This was the diagnostic question, and the answer is good news: **the limb
machinery did not fail. In both families the failing gate is a different,
downstream check that never consults the structure the machinery already
captured.** Extending the machinery to other families is therefore not
disproven by these cards — but it must be extended *to the gates*, not just
to the prompts.

**Card 15 (MAE, machinery present).** The limb tree is not in the code path
at all; the failing gate is clause-label verification. The mechanism works —
it verified 14 of TopBuild's 17 carveouts this way. It fails on SkyWater
because the "section" is the whole 43,569-byte Annex-A containing two
structurally parallel, partly byte-identical MAE definitions. Adjacency
requires a unique occurrence in the section text; the twin makes every
identical carveout non-unique. The candidate already carries the
disambiguator (`defined_term_ref`: Company vs Parent MAE), and
`uniqueDefinitionRecord` machinery for locating a definition's own span
exists (`candidate-resolution.js:1565-1568`). One join is missing: slice the
*definition's* span, not the annex's, before testing adjacency. Resolver-only
fix, no prompt digest touched.

**Cards 03/06 (representations, machinery present and working).** Traced in
`redhat-representations-20260808-r1`: 48 review rows, and every one carries a
resolved `attachment_position` (CHAPEAU / ITEM / TRAILING) — so
`shapeRepresentationInstance` → `resolveQualifierAttachment`
(`anthropic-provider.js:811`) ran, the tree minted, and attachment resolved
positionally. What failed is `classifyQualifierQuote`, which is called with
**only `claim.raw_value`** (`candidate-resolution.js:6267`) — the isolated
qualifier text. Two sub-failures:

1. The MAE-qualifier idiom has no marker of its own, so a chapeau qualifier
   quoted alone can never classify (card 03).
2. Even when ACCURACY fires ("in all material respects", ITEM), the
   Ben-approved code whitelist's canonical forms are **host+qualifier
   composites** ("true and correct in all material respects") matched against
   the whole quote — so a qualifier-only quote yields code null →
   REVIEW:UNCLASSIFIED (`qualifier-kind-lexicon.js:978-991`). This accounts
   for the "in all material respects" rows refusing alongside 03/06.

So the two committed designs disagree about the unit: the whitelist assumes
host and qualifier travel together in one quote; the producer contract
deliberately separates them and records the relationship positionally. The
tree knows the host assertion's byte span for every ITEM qualifier with a
resolved `governs_path`. The classifier never asks it. **One missing join,
not missing machinery.**

A correction to a claim made mid-review: `qualifier-attachment.js` is *not*
wired only to parked CAPITALISATION. `representations-producer-prompt.js`
line 42 carries the full attachment contract, and the RedHat run's review
rows prove it executes live. Ben's position-based model is running in two
families today; MAE_DEFINITION is the one that lacks it (no `attachment` in
its prompt).

---

## 4. The termination divergence: why Modiv resolves 12 and Concho 0

Verified counts (from `resolution.json` in each evidence directory):

| Run | resolved | dominant review reason |
|---|---|---|
| modiv-20260806 | 1 | TERMINATING_PARTY_REF_NOT_IN_QUOTE ×12 |
| modiv-20260807-**replay** (same bytes) | **12** | (identical queue kept) |
| redhat-20260808 | 0 | …NOT_IN_QUOTE ×7 |
| concho-20260808 | 0 | …NOT_IN_QUOTE ×13 |
| skywater-20260808 | 1 | …NOT_IN_QUOTE ×8 |
| metsera-20260808 | 1 | …NOT_IN_QUOTE ×9 |
| topbuild-20260808 | 7 | mixed |
| skechers-20260808 | 5 | mixed |

**What changed between the two Modiv runs:** commit `fb7f1c64` (Aug 6) added
`findTerminationLimbGrantContext`. It recognises exactly two limb-head
grammars, both taken from Modiv's own drafting:

- `by written notice from X to Y` (`TERMINATION_LIMB_FROM_TO_PATTERN`, `:1689`)
- `by either X, on the one hand, or Y, on the other hand` (`:1692`)

plus the older section-level `findTerminationGrantContext` with two more:
`X may terminate this Agreement` and `this Agreement may be terminated …by X
if` + a colon (`:1634-1635`).

**Why the four newer deals get 0–1** (chapeau forms verified in the canonical
texts):

| Deal | Actual grant form | Matches? |
|---|---|---|
| modiv | "by written notice from the Company to Parent, if:" / "by either the Company, on the one hand, or Parent, on the other hand" | both → 12 |
| redhat | "by either Parent or the Company, if:" | no ("on the one hand" absent) |
| concho | "by either the Company or Parent:" | no (also no "if") |
| skywater | "by either the Company or Parent:" / bare "by the Company:" | no |
| metsera | "by either Parent or the Company:" | no |
| topbuild | "…may be terminated…by the Company if" (single-party limbs) | partial → 7 |
| skechers | "by either Parent or the Company, at any time prior to the Effective Time if" | partial → 5 |

The resolver resolves termination exactly where the drafting matches a
regex written for a previous deal, and nowhere else. The corpus's single
most common mutual form — plain "by either X or Y" — matches nothing.

**The second divergence (Class D):** Concho's mutual-consent candidate went
*open world*, not review, because its model response set
`terminating_party_scope: null` where SkyWater's identical candidate said
`EITHER_PARTY`. The gate is `PARTY_SCOPE_OUT_OF_ENUM`
(`candidate-resolution.js:9553-9555`); the corroborating pattern that
would settle it deterministically already exists and fires on both quotes.

**Direct answer to Ben's question ("do I need to give more approved
phrases?"):**

- For termination party-grants: **no.** The gap is two grammar forms
  ("by either X or Y" without the one-hand verbiage; bare "by X:" limb
  heads), and every new deal can mint a new variant — phrase curation here is
  a treadmill. The durable fix is structural: the sectionizer already knows
  which limb a candidate sits in; parse that limb's own head once,
  generically. (Cheap interim: add the two forms — see Stage 1.)
- For Class D: **no** — no phrase list fixes a model deciding to emit null;
  derive scope from the chapeau/quote instead of gating on the model field.
- For Class B: **yes, and only here.** `TRIGGER_KIND_UNCORROBORATED` rows
  (4 on RedHat, 7 on TopBuild, 2 each Metsera/Concho-family),
  `CATEGORY_UNCORROBORATED` (card 04), `MAE_CARVEOUT_UNCORROBORATED`
  (2 SkyWater rows), and the ACCURACY code whitelist are all genuinely
  Ben-curated, versioned vocabularies with an existing governance path
  (the whitelist is already marked "Fable-tier, Ben-reviewed, versioned",
  and the ruling corpus `applyRuling` is plumbed at
  `candidate-resolution.js:6216`). Section 8 lists exactly what to put in
  front of him.

---

## 5. Step 2F2 and this problem: same defect or two?

**Two defects, operationally coupled.** Evidence they are distinct: the
termination producers emitted 25–30 candidates per deal (13–17 open-world +
9–16 review + resolved) — no recall suppression there; the loss is entirely
resolver-side refusal. 2F2 is the opposite end: prompts whose RESPONSE_SHAPE
shows a pre-filled `"open_world_candidates": []` suppress *emission*
(guaranty 0→4, dividends 0→6 when fixed — real recall, not cosmetic).

But sequencing matters, and the earlier adjudication ("a different defect at
a different stage", correct as far as it went) missed the coupling:

1. Fixing 2F2 alone will pour more candidates into gates that refuse
   structurally-dependent facts, so its measured benefit lands in
   `open_world`/`review_queue`, not `resolved`. Measure 2F2 by candidate
   counts, not resolved counts, or it will look like a failure.
2. Any unit-of-extraction change (Stage 6) rewrites the same prompts and
   bumps the same digests. Doing 2F2 separately first on a family that later
   gets the unit change pays the digest-invalidation cost twice.

Recommendation: keep 2F2, but split the thirteen — families slated for a
unit-of-extraction bump get the shape fix folded into that same digest bump;
the rest get 2F2 standalone. The sweep is not cosmetic; it is just not the
same lever, and it should not be sequenced as if the two were substitutes.

---

## 6. Ruling on the target architecture: provision-as-excerpt, facts as interior positions

**Endorsed, with one hard guard: the atomic claim layer stays.** The unit of
*evidence* should become the whole provision; the unit of *identity and
comparability* must remain the atomic fact (code / canonical value / concept
key). Reasoning, on things verified in this repo:

- **Cross-deal comparability is keyed on codes, not span text.** Concho
  no-shop resolves 78 claims; one sentence ("engage in, continue or otherwise
  participate in any discussions or negotiations…") carries six
  NO_SHOP_PROHIBITED_ACTION claims with six distinct `action_code`s sharing
  one quote. "Which deals prohibit continuing negotiations" is answered by
  `CONTINUE_NEGOTIATIONS`, not by string-matching the span. Widening the
  excerpt cannot weaken that lookup. The decomposition Ben likes survives —
  six facts, one excerpt — because it is already how no-shop works.
- **The schema already supports it.** `ordered_component_assignments`
  (`{component_slot_key, governed_slot_ordinal, semantic_span_id}`) is live
  across `lib/canonical-v2/` and observed on a real 452-byte whole-sentence
  excerpt in `concho-no-other-reps-fraud-20260808-r1`. Interior addressable
  spans on one excerpt are a solved problem here.
- **The position→scope pattern is proven.** `qualifier-attachment.js` asks
  the model only for verbatim text + position and derives scope by fixed
  rule, precisely so the model never silently guesses scope. That is Ben's
  model, running today in two families.
- **The real cost is identity churn, and it is per-family, not global.**
  `rebuildClaim` folds attributes into revision identity, and claim-evidence
  ids fold absolute offsets; changing the evidence unit re-mints identities,
  breaking replay parity against committed evidence for the changed family.
  So the cutover is: prompt digest bump + re-extraction + evidence
  regeneration, one family at a time. Not a tweak; a funded step per family.

**Is chapeau-inheritance-as-lookup a stepping stone or a dead end?**
A genuine stepping stone. Both designs need the identical capability — given
a candidate, deterministically locate its governing chapeau/limb-head/host in
the sectionizer tree. Under the cheap fix that lookup feeds corroboration;
under provision-as-excerpt the same lookup *chooses the excerpt boundary*.
The only code the big design throws away is the per-deal regexes, which are
due to die regardless. Precedent that the bridge works:
`termination_grant_context { grant_quote, trigger_limb_quote }` — the resolver
already attaches the found chapeau to the claim (`:9460-9467`), which is also
the fix for Ben's presentation complaint (a review card showing the rule the
exception hangs off) without waiting for the full re-architecture.

---

## 7. Staged fix

Each stage is independently fundable, cheapest-first, resolver-only unless
stated. "Digest" = prompt-digest invalidation (evidence regeneration).

**Stage 0 — Re-score the blind set against current main.** Card 05 is
already fixed (`fb7f1c64`); the 96 cards predate the Aug 6–8 resolver work.
Replay-only sweep, no code. *Evidence:* per-card before/after table; do not
fund fixes for cards that already resolve. Cost: hours. Digest: none.

**Stage 1 — Two termination limb-head grammars.** Add plain
`by either X or Y[,:( if)]` and bare `by X[,:]` to
`parseTerminationLimbDirection` / the section-grant patterns, keeping the
capacity-comparison discipline of `fb7f1c64` (never a substring check — every
Modiv trap documented at `:1766-1777` still applies). Also derive
`terminating_party_scope` from the matched grammar when the model's field is
null (kills the Concho/SkyWater coin-flip, Class D). *Evidence:* redhat /
concho / skywater / metsera termination replays move from 0–1 resolved to
Modiv-like counts from byte-identical recorded responses; cards 01 and 08
leave the queue. Cost: ~1 day + tests. Digest: none (replayable).

**Stage 2 — Scope MAE label verification to the definition record.** Use the
candidate's `defined_term_ref` + `uniqueDefinitionRecord` to slice the
governing definition's own span as `sectionText` before adjacency. *Evidence:*
SkyWater's 12 CLAUSE_LABEL_NOT_IN_QUOTE rows resolve or fall to their real
reasons; card 15 resolves; TopBuild's previously-passing 17 unchanged. Cost:
small. Digest: none.

**Stage 3 — Qualifier host-composition at the classifier.** For an ITEM
qualifier with resolved `governs_path`, fetch the host assertion node's text
from the limb tree (already minted, `candidate-resolution.js` already calls
`mintLimbComponentTree`); classify `host + qualifier` against the existing
whitelist. For CHAPEAU, compose with the representation's accuracy stem where
the tree has one. Add the standalone MAE-qualifier idiom and any
qualifier-only whitelist forms Ben approves — a versioned lexicon bump,
Ben-reviewed by the standing rule. *Evidence:* RedHat's 48-row review queue
collapses to genuine items; card 03 resolves; card 06 stops being a
standalone card (see open question 1). Cost: 2–3 days. Digest: none; lexicon
version bump only.

**Stage 4 — Closing-conditions obligor from the section chapeau.**
Deterministic parse of the conditions section's own chapeau ("The obligations
of X… are subject to") — same shape as `findIocChapeau`; inherit the obligor
when the model's field is null (the prompt already tells it to emit null).
*Evidence:* card 16 resolves; PARTY_UNRESOLVED bring-down rows drop across
deals. Cost: ~1 day. Digest: none.

**Stage 5 — IOC positional scope.** Let a chapeau-positioned EXCEPTION
corroborate PARENT_COVENANT scope structurally (its located span falls inside
the section chapeau, before the colon that opens the restriction list),
keeping `parentWideLanguage` as an alternative route, never removed.
*Evidence:* card 70 resolves; Skechers IOC queue drops. Cost: 1–2 days.
Digest: none.

**Stage 6 — The unit-of-extraction change (Ben-funded, per family).** One
shared structure-context service (sectionizer tree + the Stage 1–5 locators
folded together) replaces the four bespoke chapeau finders; producer prompts
move to provision-as-excerpt with interior component positions
(`ordered_component_assignments`), atomic claims preserved. Fold each
family's 2F2 shape fix into the same digest bump. Start with whichever family
still has the highest refusal density after Stages 1–5 — measured, not
guessed. *Evidence per family:* before/after resolved + review counts on all
seven deals, parity harness green, and a review-card spot check by Ben
showing rule + exception on one card. Cost: prompt digest + identity churn +
evidence regeneration per family; the big rock, de-risked because Stages 1–5
build the exact structure lookup it needs.

**Parallel, Ben-effort (Class B vocabulary):** see section 8. Independent of
all stages above.

---

## 8. What Ben should look at (with our proposed handling)

1. **Five real limb-head strings** (redhat / concho / skywater / metsera /
   skechers, section 4 table) — approve the two grammar forms Stage 1 adds.
2. **ACCURACY whitelist additions** (Stage 3): the standalone MAE-qualifier
   idiom; whether qualifier-only forms ("in all material respects" at ITEM ⇒
   MAT_ALL_MATERIAL) join the whitelist; "in any material respect" as a
   variant or as noise. Identity-semantics — his call by standing rule.
3. **IOC category vocabulary**: add "Organizational Documents" (and survey
   the other deals' defined terms) to CHARTER. Cheapest possible win; card 04
   and two siblings resolve on Concho alone.
4. **Termination trigger corroboration phrases**: the
   TRIGGER_KIND_UNCORROBORATED rows (13 across the corpus) grouped with the
   phrase that failed and the pattern that missed — genuine curation work he
   said he is willing to do.
5. **SkyWater's two MAE_CARVEOUT_UNCORROBORATED rows** (credit-rating
   downgrade carveouts) — same curation channel.

## 9. Could not determine — we want your brain

1. **Card 06 policy.** Should a bare recurring qualifier ("in any material
   respect") ever exist as a standalone card, or only as an attribute of its
   host rep? Your NOISE verdict suggests attach-or-suppress; Stage 3 needs
   the rule stated.
2. **Mutual rights: one row or two?** "By either the Company or Parent" —
   for cross-deal statistics, is that one EITHER_PARTY right or one right per
   party? Affects Stage 1's minting and every termination count we show you.
3. **Parent-MAE definitions.** Card 15's twin exists because SkyWater defines
   a Parent MAE with identical carveouts. Should Parent-MAE carveouts be
   first-class rows, suppressed, or a separate statistics bucket? The code
   already flags the bilateral-definition question as "a Ben call"
   (`candidate-resolution.js:8402-8405`).
4. **Review-card shape under provision-as-excerpt.** You asked for the rule
   the exception hangs off. Is the full provision with the fact highlighted
   acceptable even when the provision is a page long (a full §5.1 chapeau +
   list)? This decides whether Stage 6's card shows the container or a
   trimmed window around it.
5. **Empty-reason review rows.** Several queues carry rows with
   `reasons: []` (7 on TopBuild, 1–2 elsewhere). We did not run down what
   emits them; a review row that cannot say why it queued is a defect of the
   same "a run that proves nothing must not read like one that proves
   everything" family. Flagging rather than guessing.
6. **Whether the blind sample should be re-drawn** after Stage 0 re-scoring,
   given at least one card (05) and possibly others were fixed between the
   draw and this review. Recommend yes; your call on timing against the four
   extractions in flight.
