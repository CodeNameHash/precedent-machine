# The determiner: how a clause becomes a determined answer

Written 2026-09-04 for Ben, to hand to the Deal Storylines app as a
reference architecture. It describes how Precedent Machine turns raw
agreement text into a legally trustworthy answer, tooth to tail, and which
parts are the load-bearing ones worth copying.

The design principle in one line: **a model proposes where to look and what
it found; deterministic code decides whether that counts, and every answer
traces back to exact source bytes.**

Ben's constraint, which the architecture exists to satisfy: *"What we can't
lose is the ability to go deterministically back to what words drove the
answer. So I think the answer is a guided AI run, then deterministic after
that."*

## Why not one or the other

**All deterministic** fails on paraphrase. Precedent Machine has measured
this: a generator matching single-word token sequences was authored against
synthetic marker text and, on real agreements, **0 of its 1,399 tokens
appeared at all**. Twenty-four provision families were stopped. Hand-writing
patterns for every way a drafter can phrase a concept is a losing race, and
the pressure it creates is to thin the patterns until they match anything.

**All model** fails on proof. A fluent wrong answer is indistinguishable
from a right one at the point of reading, and a lawyer cannot sign work he
cannot trace. The predecessor pipeline produced 1,111 fluent rows and a
50-item review scored 19 correct, 31 incorrect.

The split below keeps each where it is strong: the model reads language, the
deterministic layer holds the standard of proof.

## The pipeline, tooth to tail

Each stage names the module that owns it. Document references are to
`docs/core/CODEBASE-GUIDE.md` unless stated.

### 1. Admission — freeze the bytes (§4.1)

The source document is fetched once, and both its raw and canonical byte
forms are hashed (SHA-256) and frozen. Nothing downstream ever re-fetches
or re-derives text. Every later coordinate is an offset into these exact
bytes.

*Why it matters:* if the text can move under you, no citation means
anything. This is the foundation the whole chain rests on.

### 2. Sectionize — deterministic, shared (§4.2)

`lib/canonical-v2/native-producer/deterministic-sectionizer.js` splits the
document into a section tree with exact UTF-8 byte offsets. It **imports**
the legacy pipeline's `parseStructure` rather than copying it, so "which
sentence is this" cannot silently differ between the two pipelines, and a
bug in shared structure code is fixed once rather than once per pipeline.

*No model involved.* Structure is mechanical.

### 3. Classify the section — two-stage, provenance-tagged (§4.3)

`section-family-classifier.js` decides which of 25 **section families** a
section belongs to — `TERMINATION_FEE`, `NO_SHOP`, `MAE_DEFINITION` and so
on. Two stages:

1. **Deterministic title rules** first. A title containing "termination"
   classifies TERMINATION *unless* it matches the fee / expense /
   effect-of-termination / sole-remedy exclusion — ported verbatim from the
   legacy classifier so fee sections never reach a termination producer.
2. **A model call only for the residue** the rules do not confidently
   classify.

The answer carries **how it was reached**, through five constants:
`SECTION_FAMILY_RULE_CLASSIFIED`, `SECTION_FAMILY_DEFINED_TERM_ANCHORED`,
`SECTION_FAMILY_AI_CLASSIFIED`, `SECTION_FAMILY_MANIFEST_ASSIGNED`,
`SECTION_FAMILY_AI_UNVERIFIED`.

*Why it matters:* in the module's own words, "a title-rule match and a
model's guess are not the same epistemic strength," and downstream code —
receipts, compiled candidates, the review queue — must never conflate them.
**This is the single most portable idea in the architecture.** Record how
confident the route was, not just the answer.

The family is deliberately coarser than a full provision type. It answers
exactly one question: *which prompt should read this section.*

### 4. Dispatch — one prompt per family, one call per section (§4.4)

`producer-prompt-registry.js` maps family to prompt builder;
`native-extraction-run.js` orchestrates. Three rules do the work:

- **One model call per section**, given **only that section's own text** —
  never the whole document. Scope is the control on hallucination: the model
  cannot cite what it was not shown.
- **The registry fails closed.** A section whose family has no registered
  producer is *not* force-fed to the nearest one. It is recorded in the run
  receipt's `undispatched_sections` and goes no further.
- **Adding a family is one file plus one registry line**, in its own
  reviewed change. The registry is the live authoritative list, so
  documentation cannot silently disagree with it.

*This is the "guided" part.* Each prompt carries the firm's own guidance for
that family — what the concept is, what counts, what does not.

### 5. Candidates, not facts (§4.4)

A producer returns a `compiled_candidate`: a typed claim about one family's
concepts, carrying **its own supporting verbatim quote and citation**. It is
explicitly *not yet allowed to assert that it is correct, unique or
governed.*

Every candidate carries a `citation_validation` object. An unaccepted
citation is never force-passed later — it is carried forward as a fact for
the resolver to act on.

*Why it matters:* the model's output is a proposal under review, not an
answer. That framing is what makes the rest safe.

### 6. Byte verification — the hard gate

`checkEvidenceScope` (`native-extraction-run.js`) rejects any evidence edge
that falls outside the section bytes the producer was actually shown, **and**
any edge whose byte slice does not reproduce the proposal's own `raw_value`
exactly. It returns a reason rather than throwing, so one bad citation
filters a proposal instead of aborting the batch.

*This is where a hallucination dies.* A fabricated quote does not match the
bytes, so the proposal fails verification and the item lands in review. Bad
model output costs a review item; it never becomes a silent wrong row.

### 7. Resolution — deterministic, no further model call (§4.5)

`candidate-resolution.js` takes raw candidates and, with no further model
call:

1. **Mints a provision.** Candidates are grouped by governing section,
   resolved concept and resolved party. A candidate whose party cannot be
   *mechanically* determined gets no provision — it is routed to review with
   reason `PARTY_UNRESOLVED`, rather than guessed.
2. **Resolves the generic key against a governed vocabulary.** One explicit,
   data-driven table maps a producer's generic key to a registered
   `claim_definition_key`. A key with no entry, or a value the registered
   definition does not allow, is **never forced onto the nearest match**.
3. **Triages into exactly three buckets.**

### 8. The three buckets — the shape to copy (§4.5)

Every extracted fact ends in exactly one of:

| Bucket | Meaning |
|---|---|
| `resolved` | Reached a registered concept, a resolved party, a single unambiguous piece of governing evidence, no known-defect match. Trustworthy. |
| `review_queue` | Reached a registered concept but failed one of those checks — ambiguous span, unresolved citation, materiality flag. Needs a human. |
| `open_world` | The generic key has no registered mapping at all. The system does not yet have a concept for this. |

The review queue is ranked by a materiality table, so a reviewer's time goes
to a termination-right dispute before a boilerplate notice clause.

*Why it matters:* which bucket a fact is in is **a legal-trustworthiness
statement, not an implementation detail.** The system is never asked "is
this right?" — it is asked "how far did this get, and what stopped it?"
That is what makes partial output shippable.

### 9. The contract vocabulary — a closed list (§4.6)

Resolution resolves against a versioned, closed list of the concepts, claim
definitions, components and relationships the system currently understands.
Versions are added alongside, never replacing, so anything already reviewed
against an earlier version keeps a stable target.

*Widening what the system can express is a deliberate, reviewed change* —
add a vocabulary entry and a resolution-table row. It cannot happen by
accident, and the model cannot invent a concept.

### 10. Coordinate rebase — one module, once (§4.7)

Because each producer call sees only one section, every candidate's evidence
offsets are **section-local**. `native-write-set-adapter.js` is the single
place where `section.start + local_offset` is computed, and it **re-slices
the document bytes** after shifting to confirm the result. Two coordinate
frames exist; exactly one module is allowed to mix them.

*Why it matters:* offsets from one section can land inside another
section's byte range and launder an unmatched hit into an apparent match.
Centralising the conversion is what stops that.

### 11. Write and serve (§4.7, §4.8)

Output is assembled into a **write set** with fixed keys in a fixed order,
under an allow-list of operations. Unlike the legacy pipeline — which
deleted and re-inserted wholesale on every ingest, and therefore needed a
fuzzy text-matching ladder to re-attach human corrections afterwards —
identity is stable across re-runs, so a correction stays attached to the
thing it corrected.

## The invariants worth copying

1. **Freeze the source bytes and hash them.** Every citation is an offset
   into frozen bytes, never into re-fetched text.
2. **Byte offsets, not string indices.** The pipeline slices by UTF-8 bytes
   everywhere. `indexOf` and `slice` count UTF-16 code units. Confusing the
   two has produced three separate confident false findings in this
   codebase. Use a conversion helper.
3. **Show the model only the scope you will verify against.** One section,
   not the document.
4. **Verify every quote against the bytes.** A quote that does not reproduce
   is not a finding.
5. **Record how the answer was reached, not just the answer.** Rule match
   and model guess must stay distinguishable forever.
6. **Fail closed everywhere.** No nearest-match fallback, no forced key, no
   guessed party, no force-passed citation.
7. **Three buckets, not true/false.** Trustworthy, needs-review, and
   not-yet-modelled are different states with different consequences.
8. **A closed vocabulary the model cannot extend.** Widening it is a
   reviewed change.
9. **Carry provenance to the served fact.** Producer receipt id, prompt
   digest, and the raw response retained, so any answer can be walked back
   to the proposal that produced it.
10. **Validators before generator.** A model behind weak checks produces
    fluent wrong output just as reliably as a rule engine does. Build the
    verification layer first; the generator is the easy half.

## Failure modes we paid for — check yours for these

- **Authoring patterns against synthetic fixtures.** Patterns written from
  made-up text matched the made-up text perfectly and real agreements not at
  all. Nothing in the process caught it, because every test ran against the
  same synthetic text the patterns came from. *Test against real documents
  from the first day.*
- **Dropping provenance at a boundary.** Resolved records carry the producer
  receipt id and prompt digest; the next stage stores a clone and drops
  them — on all 1,528 claims. Traceability is only as good as its weakest
  hand-off. *Assert provenance survives each stage.*
- **Documents outliving the code.** Two places in the codebase guide state
  that V2 output is served in production. It is gated off, and the same file
  contradicts itself later. *Update the header in the same change as the
  behaviour.*
- **Believing a header comment.** A header claiming "this module only does
  X" is a claim to test, never a fact to record.
- **A run that proves nothing reading like a run that proves everything.**
  Distinguish "compared and passed" from "could not compare."

## For Deal Storylines

The parts that transfer directly, in priority order:

1. **The three-bucket output.** Resolved / needs-review / not-yet-modelled,
   with the bucket as a trustworthiness statement. This alone changes what
   you can ship.
2. **Provenance constants on the classification.** Whatever decides what a
   thing is, record whether a rule or a model decided it.
3. **Scope-limited model calls with byte verification.** Show one unit,
   demand a verbatim quote, verify the quote against the bytes, discard what
   does not reproduce.
4. **A closed vocabulary the model resolves into**, rather than free-text
   labels it invents.
5. **One module owning any coordinate conversion.**

The parts that are Precedent Machine specific and should not be copied
wholesale: the sealed-authority and content-addressed registration
machinery, the M0–M10 stage gates, and the 25 family split itself, which is
a merger-agreement taxonomy.

## Sources

- `docs/core/CODEBASE-GUIDE.md` §4.1–4.8 — the pipeline end to end;
  §4.9 is a worked example following a termination fee to a lawyer's screen;
  §8 separates load-bearing invariants from convenience.
- `docs/core/OPERATING-RULES.md` — the authority boundary and standing
  conventions.
- `docs/core/DECISIONS.md` — decisions with reasoning; #18 on the general
  extraction permission and why it does not unlock a second model route.
- `docs/core/PLAN.md` — the step plan, including the model-experiment
  decision path and its preconditions.
- `docs/core/GRAVEYARD.md` — what was built and is no longer used.
- `CLAUDE.md` — the failure modes this programme repeats, and the traps.
- Code: `lib/canonical-v2/native-producer/` — `deterministic-sectionizer.js`,
  `section-family-classifier.js`, `producer-prompt-registry.js`,
  `native-extraction-run.js`, `candidate-resolution.js`,
  `lexical-disagreement-net.js`, `native-write-set-adapter.js`.
