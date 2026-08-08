# Do derived limbs need identity, or is annotation enough?

Open architectural question, raised by Ben 2026-08-08 while Step 2X-A was being
broadened. Recorded because it is a decision that is cheap to make now and
expensive to retrofit, and because the analysis below turns on a measurement
that would otherwise have to be redone.

Ben's framing: *"Are we sure we don't need to give them identity too? I'm not
saying we do, but given we're at such a key architecting stage I want to make
sure we are being fully rigorous on the right approach."*

## The current proposal

Step 2X-A broadened gives all 22 flat-assertion families a `structure_context`
— the governing chapeau chain, by containment on the byte spans their claims
already carry. **Annotation only.** Identity stays with model-declared limbs
(capitalisation, representations), which mint `provision_component` rows.

## What flat rows cost, ranked

1. **Scope.** "In all material respects" on the chapeau and on limb (b)(i) are
   different legal facts. Flat rows cannot tell them apart. This is card 6.
2. **Inheritance.** An exception cannot carry the rule it excepts from when
   there is no rule object to point at.
3. **Cross-deal comparison.** Two deals' limbs are comparable when both are
   known to sit at the same position under the same chapeau concept. Flat rows
   can only be compared by text similarity.
4. **Deduplication.** Two claims quoting overlapping spans within one limb are
   probably one fact.
5. **Absence.** A section with 12 limbs and claims from 4 has 8 unrepresented.

## The distinction that decides it

**Annotation can answer any question about what we extracted. Only identity can
answer questions about what we did not.**

Items 1–4 work as annotation — claims can be queried by `structure_context`
without limbs being objects. Item 5 cannot: **you cannot annotate a claim that
does not exist.** To state "this section has a limb with no claim against it",
the limb must be addressable.

Absence is a large share of what the product is asked. "Does this deal have a
go-shop?" is an absence question. "Why does one deal yield 0 and another 10?"
is an absence question. The whole unsafe-absence-wording workstream exists
because absence was being asserted without evidence.

**So the honest answer is that we probably do need identity eventually.** The
current proposal is not wrong, but it is not sufficient either, and it should
not be presented as a settled endpoint.

## Why derived identity is not safe to mint today

Two reasons, one evidential and one measured.

**Evidential.** A model-declared limb is attested against the text by the
producer. A derived limb is inferred by us. At the measured 98.9% clean rate,
roughly 1% of derived limbs would be wrong *and* content-addressed — wrong
permanently, silently, and referenced by whatever claims attach to them.

**Measured.** Leaf spans are not stable under algorithm change. Same input,
varying only `MAX_DEPTH`:

```
MAX_DEPTH=2 → chapeau[0,30] a[33,54] b[57,81] b.i[84,139]
MAX_DEPTH=3 → chapeau[0,30] a[33,54] b[57,81] b.i[84,112] b.i.A[115,126] b.i.B[129,139]
MAX_DEPTH=4 → identical to 3
```

`b.i` moves from `[84,139]` to `[84,112]` and two new leaves appear.
`provision_component_id` is content-addressed over
`{parent_provision_instance_id, canonical_text_id, absolute_start,
absolute_end, component_key, ordinal}`, so derived components would re-mint on
that change. The segmenter changed twice on 2026-08-08 — the colon rule, and
the depth and `(x)/(y)/(z)` work now in flight. Had derived identity existed,
both would have silently re-minted a share of the corpus.

## The synthesis worth testing

Read the numbers again: `b` is `[57,81]` at every depth, and `b.i` **starts** at
84 at every depth. Only the **end** moves, because a leaf's end is "up to the
next sibling-or-shallower marker" and therefore depends on what the algorithm
recognises.

**A limb's beginning is a fact about the document. Its extent is a fact about
our algorithm.**

So: anchor derived identity on the **start offset of the marker token**, carry
the extent as a re-derivable attribute rather than as part of the identity.
Derived limbs then get stable identity that survives segmenter improvement.

Three things must be checked before relying on this:

1. Is start-offset genuinely invariant under both changes in flight? Depth
   should not move any existing marker start. `(x)/(y)/(z)` recognises *new*
   markers, which does not move existing starts — but it can split a leaf that
   previously contained them, so a leaf's end still moves.
2. Can `component_key` and `ordinal` be made stable? `ordinal` derived from
   document order changes when new markers appear between existing ones.
3. **Is there a third option — derive limbs as excerpts rather than as
   components?** Excerpts are already content-addressed byte ranges, stored
   once and shared. If a derived limb is naturally an excerpt, the component
   identity problem may not need solving at all. This has not been thought
   through and may be the best answer.

## Recommendation, pending review

Ship `structure_context` now: it is free, replay-validated, unblocks items 1–4,
and carries no identity-stability cost. **Design the identity model now rather
than retrofitting it**, with an explicit stability criterion — no derived
identity until the segmenter has gone some agreed number of changes without
moving a marker start.

Retrofitting identity later is expensive. Designing it now and enabling it when
the stability criterion is met is cheap.

## Status

Open. Not decided. Put to Fable as a design question, or decided with Ben.

---

# Fable review, 2026-08-08 — the three questions answered

Reviewer: Fable, same session lineage as `fable-review-step-2x.md`. Code read:
`source-structure.js` (`buildExcerpt` :169, `buildProvisionComponent` :377),
`qualifier-attachment.js` in full, its test in full,
`native-write-set-adapter.js` excerpt caching (:822–845),
`deterministic-sectionizer.js` header, PLAN 2X-A as broadened. Two corpus
greps run over `evidence/canonical-v2` (results below). `subclauses.js` not
touched — under edit by another agent; residual uncertainty flagged where its
in-flight changes matter.

## 1. Annotation or identity — decided

**Ship annotation now, exactly as 2X-A broadened says. Design derived
identity now as start-anchored. Do NOT use excerpts as identity — that hope
is false, and here is the measurement against the code.**

**The excerpt option fails on inspection.** `excerpt_id` is content-addressed
over `output_text_hash` (hash of the exact sliced text) plus
`ordered_component_assignments`, which embed the `semantic_span_id`, which is
itself `contentId` over `{canonical_text_id, absolute_start, absolute_end}`
(`source-structure.js:156–192`). An excerpt's identity therefore moves
whenever its **end** moves — today's MAX_DEPTH measurement re-mints
excerpt-limbs exactly as it re-mints components. Worse, an excerpt carries no
parent, no path, no position-in-outline: the absence question ("this section
has a limb with no claim against it") cannot even be *asked* of a set of
excerpts without a separate limb→position mapping, and that mapping is the
identity problem again under another name. Excerpts are the right way to
attach a limb's **extent as evidence** (deduped, cached once per id in
`native-write-set-adapter.js:840`), and the wrong thing to *be* the limb.

**The synthesis is right but under-specified.** Start-anchoring is necessary
but not sufficient: the dotted **path must also stay out of identity**. The
path encodes parentage, and parentage is an algorithm output — the six
mis-nested sections show exactly this (TopBuild's `b.2.1` should be a sibling
of `b`, not a grandchild; fixing the segmenter re-parents it). If path were
in the identity, the 1.1% mis-nests could never be fixed without re-minting.
So:

- **Identity** = `{canonical_text_id, marker_start_byte}`, with the marker
  token stored as a *checked attribute* (a start whose token changes is a
  refused re-derivation, not a silent match).
- **Attributes, all re-derivable:** parent, depth, path, extent — extent as a
  reference to an excerpt, which re-mints freely on algorithm change without
  disturbing limb identity.
- This also answers the note's check 2 by dissolving it: start byte totally
  orders and uniquely keys limbs within a canonical text, so **ordinal
  leaves the identity entirely** and the new-marker-between-existing-markers
  problem disappears.
- **Do not bend `PROVISION_COMPONENT/V1` to this.** Its identity payload
  hard-codes `parent_provision_instance_id`, both offsets and `ordinal`
  (`source-structure.js:400–408`), so a parent extent change cascades a
  re-mint through every child. Derived limbs need their own schema
  (`DERIVED_LIMB/V1` or similar), and keeping the schemas distinct also keeps
  the provenance distinction (attested vs inferred) queryable forever.

**Stability criterion, made concrete.** The two changes in flight are a free
natural experiment: after they land, rerun the corpus survey and diff marker
starts against today's. The criterion is zero start moves across 2,360
markers. Uncertain until run — depth cannot move a start by construction, but
the `(x)/(y)/(z)` list-opening change recognises new tokens and I have not
seen its final form.

**The residual that no identity scheme fixes:** the ~1% attestation problem.
A phantom limb (a false marker) mints identity for a limb that does not
legally exist, and absence is precisely where that error is load-bearing —
"limb (b) has no claim" is distorted by both phantom and missed limbs. So
absence answers built on derived limbs must carry derivation provenance and
the measured error rate, and must never render as ground truth.

## 2. Ben's whole-document thesis, attacked

Objections that survive contact with the evidence, worst first.

**2.1 Structure that gates model input is the killer, and it is the natural
next step nobody has proposed yet.** Today derived structure annotates
*after* the model has seen whole sections. The tempting future use — chunk
prompts by derived limbs, serve "just the relevant limb" — converts a 1%
segmentation error into an invisible coverage hole: the model never sees the
mis-bounded text, so there is nothing to disagree with, no competition
signal, no review row. Every other failure mode below is detectable; this one
is not. The guard is a written rule: **derived structure may describe what
the model said, never select what the model reads.**

**2.2 The 98.9% measures signature-cleanliness, not correctness.** The survey
counted sections free of the *same-style* parent-child signature. A mis-nest
that happens to change style — or a phantom marker in prose, e.g. a bare
"(b)" inside a parenthetical — is not counted by that instrument. 98.9% is a
lower bound on the known failure mode, not a verified accuracy figure, and
2X-A's prose ("clean on ~99%") reads like the latter. Uncertain; settled by a
human spot-audit of a random sample of unflagged marker-bearing sections
(30 sections would bound the unknown-unknown rate usefully).

**2.3 Anchoring is real but avoidable.** Shown to the model at extraction
time, derived structure converts an independent check into a correlated one —
the model defers to the tree, and disagreement (the one signal corroboration
consumes) disappears. Post-hoc corroboration is the opposite: disagreement is
the product. Same rule as 2.1, upstream flavour: structure out of prompts.

**2.4 Foreclosure is governed by one storage rule.** Once structure_context
or derived limbs enter any content-addressed identity, a segmenter fix
becomes a corpus migration — today's two changes would both have been
breaking. The rule: every stored derived output carries a segmenter version,
and derived facts stay out of `contentId` payloads until the §1 stability
criterion is met. With that rule, changing the parser is a re-annotation, not
a migration.

**2.5 Maintenance is real but shows up as a metric, not a wound.** Fail-closed
means a new filer's unrecognised convention degrades to UNDETERMINED /
coarser context, visible as a rate per deal. A parser that guessed would be a
permanent liability; one that refuses is a permanent *instrument*.

**2.6 Prose sections: no objection survives.** 171/538 markerless sections
get section-level context only. That is not invented structure; it is the
honest floor, and whole-document structuring adds the section tree above it —
which, note, already exists: `deterministic-sectionizer.js` builds the
ordered section tree with byte offsets from admitted bytes, model-free.
Cross-reference targets ("Section 7.1(c)") and defined-term *declaration*
sites ('"X" means') are closed formal conventions — tier 1 of the determinism
rule in fable-review-step-2x.md §2 — and belong in scope. Defined-term
*usage/scope* linking is open drafting and does not.

**Verdict: the thesis survives, in disciplined form.** Ben asked "how can it
hurt?" — it can hurt in exactly three ways: gating model input (2.1/2.3),
being read as ground truth in absence answers (§1 residual), and leaking into
permanent identities before stability (2.4). All three are policy-avoidable;
none is inherent to computing the structure. "More structure is just better"
is true of structure *computed and versioned*; it is false of structure
*trusted and baked in*. The whole-document form is also less new than it
sounds: sectionizer + segmenter + closed-convention cross-refs and
defined-term sites is an assembly job over parts that mostly exist.

## 3. Carry-both-readings as a general pattern

Read in full: `qualifier-attachment.js` and its test. The pattern there:
CHAPEAU→ALL_ITEMS, ITEM→THIS_ITEM_ONLY, bare TRAILING→AMBIGUOUS carrying both
SERIES and LAST_ANTECEDENT readings with concrete `governs_paths`.

**3.1 It is not general as "both". It generalises as "the enumerable reading
set, carried per ambiguity site".** It works for qualifiers because the
ambiguity is a single attachment decision with a closed, tiny reading set and
a human consumer. Two limits, one of them already live in the corpus:

- **More than two readings exist today.** The corpus is full of *named
  subset* references: `in the case of clauses (ii) and (iii)` (98 hits in
  evidence files), `(A) and (B)` (40), `(B) and (C)` (32), `clauses (i)
  through …` (121 files). These are neither ALL_ITEMS nor THIS_ITEM_ONLY —
  they are NAMED_SUBSET, a third reading family. And the current
  single-clause regexes (`/in the case of clauses?(?:\s*\([^)]{1,20}\))?/i`)
  match only the first parenthetical, so "in the case of clauses (ii) and
  (iii)" resolves deterministically to **THIS_ITEM_ONLY — wrong**, silently,
  with high confidence. The binary schema is already being shoehorned.
- **Tree ambiguity does not enumerate.** One section with n independent
  ambiguous nestings has 2^n whole trees; "emit both trees" becomes emit a
  parse forest. The general form is a shared invariant plus local
  alternation: the part of the structure identical under every reading,
  plus readings only at each disputed site.

**3.2 Should the segmenter emit both trees instead of UNDETERMINED?** Emit
the **invariant prefix plus readings at the ambiguity site**, not two whole
trees. For a same-style restart, the chapeau chain down to the disputed link
is identical under both readings — that prefix is safe context for every
consumer, and is strictly more informative than today's blanket refusal. But
the schema must make lazy consumption impossible: on AMBIGUOUS, no `chain`
field at all — only `agreed_chain_prefix` plus `readings[]`. A consumer that
can reach `readings[0]` through the same accessor as a resolved chain will
eventually do so, and carry-both silently degrades into pick-first, which is
*worse* than UNDETERMINED because it wears a resolved face. Downstream can
consume plurality safely only with a stated algebra: absence asserted only
under **all** readings, presence flagged under **any**, review shown the set.

**3.3 Where carrying both is unsafe:** wherever the consumer must emit a
single value with no human present. Identity minting (two ids, one
permanently wrong, both content-addressed); deduplication merges (merging
under one reading irreversibly destroys the other); any single-number
precedent score. Rule: readings may flow into annotation, review surfaces
and all/any-quantified queries; they must never flow into `contentId`
payloads or irreversible merges.

**3.4 The lexicon: yes, and the corpus has opinions.** Grep over
`evidence/canonical-v2` (file counts, inflated by cross-run duplication —
adjudicate before trusting):

- **"in any case" is a false friend in the shipped lexicon.** Corpus uses are
  dominated by non-scope senses: "in any case **asserted or arising** before
  or after the Effective Time" (litigation case), "in any case **no later
  than 24 hours**" (in any event), "in any case **obligating** the Company
  to issue…" (any instance that obligates). A trailing qualifier quoting any
  of these resolves ALL_ITEMS deterministically and wrongly. This is the
  correlation-not-disambiguation trap, already shipped.
- **Two shipped patterns have zero corpus occurrences**: "in each of the
  foregoing", "with respect to each of the foregoing". Harmless, but proof
  the lexicon was intuition-seeded, not corpus-seeded.
- **Seed candidates with corpus presence:** "in the case of each" (272),
  "in any such case" (115), "in respect of each" (109), "for purposes of the
  foregoing" (30); plus the NAMED_SUBSET forms above as their own reading,
  not as single-clause matches. Excluded deliberately: "for the avoidance of
  doubt" (311) and "it being understood" (389) — proviso markers, not scope
  markers.
- **Confirmation method = the 2X-G promotion gate, applied to phrases.** For
  each candidate: pull every trailing-qualifier occurrence corpus-wide;
  adjudicate scope blind (human, or the blind re-score process); promote only
  on zero counterexamples across ≥3 deals; and run the collision test — does
  the phrase ever occur in a non-scope sense ("in any case" fails it today).
  A phrase disambiguates if and only if its presence *predicts* the
  adjudicated scope with no cross-deal counterexample; anything less is
  correlation.

## 4. What is wrong in the note and in 2X-A as broadened

1. **Note, "third option" (§ synthesis, item 3): the excerpt hope is false.**
   Measured against `buildExcerpt`: excerpt identity embeds both offsets and
   the text hash, so it re-mints on extent change exactly like a component,
   and carries no position, so absence cannot be asked of it. Assessed and
   closed above.
2. **Note, synthesis under-specified:** start-anchoring alone is not enough;
   path/parentage must also leave identity, and `ordinal` should be dropped
   rather than stabilised (start byte already totally orders limbs).
3. **2X-A prose, "clean on ~99% of sections":** overstates the measurement.
   98.9% is signature-clean (free of the same-style link), not
   verified-correct; the instrument cannot see style-changing mis-nests or
   phantom markers. Needs a spot-audit before the number is quoted as
   accuracy.
4. **2X-A, "MAX_DEPTH truncation … never a wrong parent":** true only modulo
   failure mode 3 (same-style restart), as fable-review-step-2x.md §5.3
   itself noted; the plan text drops the caveat.
5. **`qualifier-attachment.js` defects found here** — the "in any case" false
   friend and the NAMED_SUBSET shoehorn — have no plan step to land in.
   Unhomed findings are exactly what this repo forgets (CLAUDE.md's named
   failure mode). They belong on 2X-A's kept-separate list as an explicit
   follow-up, or as a new lettered step.
6. **Nothing else in the note is contradicted.** The MAX_DEPTH measurement,
   the component-id field list, and the two-changes-today count all check out
   against the code and PLAN as written.
