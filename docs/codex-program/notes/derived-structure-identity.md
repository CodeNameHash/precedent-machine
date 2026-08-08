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
