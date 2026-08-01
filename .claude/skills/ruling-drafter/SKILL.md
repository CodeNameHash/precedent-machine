---
name: ruling-drafter
description: Draft a recommended qualifier-KIND ruling for one queued review-queue quote, with reasons anchored verbatim to the quoted words. Used by scripts/draft-kind-rulings.mjs when composing the prompt sent to the cheap model. Not a general-purpose classifier skill -- it answers exactly one question (KIND, and optionally an ACCURACY code) for one quote at a time, and its output is always AI-tagged and advisory.
version: 1
disable-model-invocation: true
---

# Draft a qualifier-kind ruling (advisory only)

You are drafting a **recommendation**, not a decision. A human reviewer
confirms or corrects every draft you produce; nothing you output enters any
system of record by itself. Only a human confirmation, written through
`scripts/confirm-kind-ruling.mjs`, ever becomes a `VERIFIED` ruling in the
ruling corpus (`contracts/ruling-corpus/ruling-corpus.v1.json`). **The draft
is advisory; a human ruling is the only thing that enters the corpus.**

This skill exists because `lib/canonical-v2/native-producer/candidate-
resolution.js`'s deterministic classifier
(`qualifier-kind-lexicon.js`) sometimes cannot decide a quote's qualifier
KIND on its own and routes it to the review queue with a typed reason
(`QUALIFIER_KIND_DISAGREEMENT`, `QUALIFIER_KIND_UNCLASSIFIED`, or
`RULING_LEXICON_CONFLICT`). `scripts/draft-kind-rulings.mjs` reads those
queue items and asks a cheap model -- driven through this skill's
instructions -- to draft the ruling a human would otherwise have to
originate from nothing.

## The four kind definitions

A queued quote fires exactly one of these families (or is split into more
than one part that each fire one, per the binding rule below):

- **KNOWLEDGE** -- the qualifier limits a representation to a party's
  knowledge. Markers: "to the knowledge of", "known to", "aware of" family.
- **TEMPORAL** -- the qualifier dates the representation or the qualifier
  itself. Markers: "as of" followed by a calendar date, or one of the closed
  symbolic dates: "the date hereof", "the date of this Agreement", "the
  Closing Date", "the Effective Time".
- **ACCURACY** -- the qualifier states a truth/completeness standard.
  Markers: "true and correct", "correct and complete", "in all respects",
  "in all material respects" family.
- **THRESHOLD** -- the qualifier states a materiality, monetary, percentage,
  or de minimis threshold. Markers: "material to ...", dollar amounts,
  percentages, de minimis carve-outs.

Only a representation-level (`CHAPEAU`-attached) ACCURACY qualifier may
resolve to a registered accuracy-standard claim. An ITEM-attached
(limb-level) ACCURACY qualifier is never a rep-level claim -- if the quote
looks ACCURACY but is ITEM-attached, say so; do not draft it as if it were
CHAPEAU.

### ACCURACY code whitelist

The controlled code comes from an **exact normalised-phrase** match against
the whole quote -- never nearest-fit, never inferred from meaning alone.
`scripts/draft-kind-rulings.mjs` includes the live whitelist (read straight
from `qualifier-kind-lexicon.js`'s `ACCURACY_CODE_WHITELIST`) in every
composed prompt, so treat the list in the prompt as authoritative over this
document if the two ever diverge. If the quote does not match a whitelist
phrase exactly, the code is `null` -- never guess a "close enough" code.

## The exception-connective binding rule

Real drafting nests qualifiers inside exception clauses. Before deciding a
kind, check whether the quote contains an auto-binding connective: "except",
"except for", "except as", "other than", "excluding". If so:

- A marker found **inside** a bound "except ..." clause is part of that
  clause's own host qualifier, never a separate, free-standing qualifier.
  Example: "true and correct, except for inaccuracies that are not
  material ..." is **ONE ACCURACY unit**, not ACCURACY plus THRESHOLD.
- A bound clause can run through a comma when the text after the comma is
  still part of the same exception -- do not assume the first comma always
  ends the clause. "... Securities Act of 1933, as amended ... or other
  applicable securities Laws" is one clause through its interior comma; a
  list exception "except for X, Y and Z, the Company ..." binds through its
  list commas too.
- "provided that" and "subject to" are **NOT** auto-binding connectives --
  they can introduce independent obligations. A quote containing one of
  these alongside markers from more than one family is genuinely doubtful;
  say so rather than picking a side.
- Nested exceptions ("(other than ...)" inside "except for ...") resolve
  innermost first: the inner parenthetical binds within itself, the outer
  clause binds to its own host.

## Instructions for every draft

1. **Read only the quoted words you are given.** Never invent facts, dates,
   or qualifiers that are not present in the text.
2. **Every reason you give must be a verbatim substring of the quoted
   words.** `scripts/draft-kind-rulings.mjs` rejects (and never stores) a
   draft where any `reasons_anchored_to_quote` entry cannot be found
   verbatim in the quote -- do not paraphrase, do not summarise, quote the
   exact words that justify your classification.
3. **If you cannot classify with a reason anchored to the quoted words,
   abstain** (`"drafted_kind": null`, empty `reasons_anchored_to_quote`).
   An abstention is discarded cleanly; a wrong-but-confident guess still
   costs only one human correction, but abstaining is preferred whenever the
   text is genuinely ambiguous -- do not force a call the binding rule
   itself says is doubtful.
4. **Respond with only the JSON object the calling prompt specifies** -- no
   prose, no markdown fences, no explanation outside the JSON fields.
5. **Never assume identity.** This skill drafts a KIND (and, for ACCURACY,
   a code) recommendation only. It never assigns a claim definition, never
   invents a canonical value, and never decides which registered mapping a
   claim resolves to -- that remains mechanical, per the design spec's
   invariant that identity is never AI-tagged.

## What happens to your draft

`scripts/draft-kind-rulings.mjs` writes every accepted draft into a
**separate** drafts artifact (`<queue-path>.drafts.json`), tagged
`answer_provenance.tag: 'AI'` with pins for the model, this script's
`DRAFTER_PROMPT_VERSION`, and this file's `version`. It never writes into
the review-queue artifact and never writes into
`contracts/ruling-corpus/ruling-corpus.v1.json`. A human reviewer inspects
the draft and, if it is correct, runs
`scripts/confirm-kind-ruling.mjs --kind ... --reviewer ...` to enter a
`VERIFIED` ruling into the corpus -- the confirmation, never the draft,
becomes the corpus entry.
