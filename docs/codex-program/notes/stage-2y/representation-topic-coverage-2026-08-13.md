# The 179 unclassified representations — what they actually are

Report-only. Nothing in `lib/vocab/` is modified; the topic registry is a
governed Phase 1 source and this note only measures it.

Wiring `representation-topic-registry.js` into the structure path classifies
951 of 1,130 authored representation sentences across the seven M2 agreements
(84%): 495 single-topic, 456 compound. **179 match no anchor at all** and are
gated to review as `M7_REPRESENTATION_TOPIC_UNCLASSIFIED`.

This is a look at whether those 179 are genuinely un-nameable or whether the
registry has vocabulary gaps.

## A real bug, which is not the explanation

Anchors are matched with a trailing `\b`, so a singular-only anchor refuses the
plural. Identical sentence, one word changed:

| sentence | result |
|---|---|
| There is no material Legal **Proceeding** pending… | `CLASSIFIED LITIGATION_ORDERS` |
| There are no material Legal **Proceedings** pending… | `NO_RAW_ANCHOR` |

**29 anchors are singular-only** in this way, including `\bproceeding\b`,
`\blitigation\b`, `\border\b`, `\bemployee\b`, `\bunion\b`, `\blabor\b`,
`\brelease\b`, `\blicen[sc]e\b` and `\bauthori[sz]ation\b`. Agreements state
most of these in the plural, so the gap is not theoretical.

**But it accounts for only 10 of the 179 — 6%.** An earlier reading of this
sample claimed the 179 were "mostly anchor gaps". That was drawn from three
examples and is wrong; the measurement is above. The plural bug is worth fixing
on its own merits and it will not move the coverage number.

## What the other ~169 are

Sampled and bucketed:

| bucket | count | example |
|---|---|---|
| unanchored subject matter | 125 | The Company Charter and the Company Bylaws are in full force and effect… |
| cross-reference / carve-out | 38 | Except as set forth in Section 3.01(o)(i)(I) of the Company Letter… |
| negative assurance | 11 | There are no voting trusts or other agreements… |
| knowledge-qualified | 3 | To the knowledge of the Company, since January 1, 2023… |
| definition | 2 | As used in this Agreement, "Affiliate" means… |

The largest bucket is vocabulary the registry simply does not carry. Two
demonstrations, same meaning, different words:

| sentence | result |
|---|---|
| The **organizational documents** of the Company are in full force and effect. | `CLASSIFIED CORPORATE_ORGANISATION` |
| The Company **Charter** and the Company **Bylaws** are in full force and effect… | `NO_RAW_ANCHOR` |

`organizational documents` is an anchor; `charter` and `bylaws` are not. Likewise
subsidiary-ownership statements ("the Company does not own, directly or
indirectly, any equity or voting interests in…") and entity-structure statements
("no partnership, joint venture or limited liability company agreement") have no
anchor, though both are ordinary corporate-organisation representations.

## What this suggests, and what it does not

Coverage is an anchor-vocabulary problem, not a design problem. The three
readings the structure path takes — content classifies, ties are compounds, no
topic is an answer — are unaffected by any of this.

Two candidate changes, both in a governed source, neither taken here:

1. **Plural tolerance** on the 29 singular-only anchors. Small, mechanical,
   provable, worth ~10 sentences.
2. **New anchors** for charter/bylaws, subsidiary ownership and entity
   structure, which is where the 125 sit. This is a legal-vocabulary judgement
   and wants Ben's eye, not a sweep.

The 179 are gated to review either way, so none of them is silently lost. The
question is only how many a reviewer has to read.
