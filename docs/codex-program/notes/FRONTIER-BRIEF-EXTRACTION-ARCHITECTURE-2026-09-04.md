# Brief: decide the extraction architecture, then build it once

You are being asked to settle an architecture question in the Precedent
Machine repository and then implement the answer. You have the repository
in front of you and no conversation history, so everything you need is
below. Do not ask for context you can read.

Precedent Machine parses merger agreements from SEC filings, classifies
provisions, extracts structured facts, and serves a review UI and a
cross-deal precedent search. The owner is a practising M&A lawyer. Read
`CLAUDE.md` before anything else, then `docs/core/OPERATING-RULES.md`,
`docs/core/PLAN.md`, `docs/core/DECISIONS.md`, `docs/core/CODEBASE-GUIDE.md`
and `docs/core/GRAVEYARD.md`.

## The owner's binding constraint, in his words

"What we can't lose is the ability to go deterministically back to what
words drove the answer. So I think the answer is a guided AI run, then
deterministic after that."

Any design you propose must preserve exact, reproducible traceability from
a served answer to the source bytes that produced it, and to the model
proposal that produced it, if a model was involved.

## The situation

Two extraction lineages exist. They are not rivals; one was built on the
other's frozen output, and the core documents describe the relationship
backwards.

**Lineage A, `lib/canonical-v2/native-producer/`** (126 modules,
`CODEBASE-GUIDE.md` sections 4.3 to 4.5). A deterministic sectionizer that
imports V1's `parseStructure` rather than copying it; a two-stage
section-family classifier (deterministic title rules, model call for the
residue, five provenance constants that keep a rule match and a model guess
distinguishable); 25 per-family producer prompts dispatched by
`producer-prompt-registry.js`; one model call per section scoped to that
section's own text; output is a `compiled_candidate` carrying its own
supporting quote and citation, explicitly not yet a fact;
`candidate-resolution.js` resolves candidates into governed facts;
`lexical-disagreement-net.js` is a pure deterministic cross-check;
`native-write-set-adapter.js` converts section-local byte offsets to
document-absolute in exactly one place. 146 evidence directories under
`evidence/canonical-v2/` from real runs. The live backend is the Codex CLI
provider, not Anthropic; `anthropic-provider.js` is a shaper seam with an
optional client.

**Lineage B, the governed M0 to M10 track.** `m7-v2-deterministic-generator.js`
tests roughly 1,382 profiles against each governed M2 node and selects the
most specific match; the family is an output of that matching. The matcher
(`profileResult`, around line 305) is `SOURCE_TOKEN_SEQUENCE` or
`SOURCE_TOKEN_ALL` over single-word tokens: not regex, not a model. Its
authority,
`evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-candidate-replacement-authority.json`,
sets `model_calls: 0` and `v1_semantic_consumption: 0` in
`prohibited_effects`.

## What two independent reviews established

Verified, and you should spot-check rather than trust:

1. B is built on A's frozen output. `agreement-analysis.js` (`buildLegacyRecords`,
   around 521 to 540) reads `resolution.json`, `adapter-result.json` and
   `validation.json` from A's run directories.
   `.../stage-2y-structure-migration/control/analysis-policy.json` binds
   about 130 such runs by SHA-256. 1,526 of M4's 1,528 claims are A's
   resolver claims re-based onto M2 byte coordinates. B imports A's
   sectionizer. A imports nothing from B. "Model calls: zero" in the M-track
   means zero NEW calls; the legal meaning already came from a model.
2. But the code B is currently repairing does NOT use A's legal content.
   `generateAnalysisV2` (around 2209 to 2222) uses M4 claims only for
   `claim_occurrence_id` and one source node id; `m7-v2-contract.js` has no
   reference to A's legal fields. So the active repair re-derives meaning
   independently. Any argument of the form "B's content is already A's,
   therefore retire B" is false for precisely the code it would retire.
3. Because M4 binds A's runs by hash and re-sealing is a whole-repair stop,
   no NEW A run can enter the governed track. The governed track has no
   extractor of its own that works on real text.
4. Neither lineage serves production. Production is V1; every V2 path is
   gated preview/local by `lib/feature-flags.js` (around 25 to 31).
   `CODEBASE-GUIDE.md` asserts production serving in two places and is
   wrong; it contradicts itself later in the same file.
5. B's first candidate failed because 0 of its 1,399 marker tokens appear in
   real agreement text. 24 families were stopped under a
   `FALSE_COMPLETE_FIXTURE` classification.
6. The owner's 50-item lawyer review scored 19 correct, 31 incorrect. This
   is widely misread. 15 of the 31 are on agreements where A has no run at
   all (13 are "no row at all"). Of the failures A is responsible for, A got
   the law wrong in one case, arguably two. The dominant failure class is
   roles and qualifiers inside a correct span never being typed. That is
   claim-definition and required-role depth, not prompt quality.
7. On the owner's constraint: A's resolved records carry
   `extraction_provenance` with `producer_receipt_id` and `prompt_digest`,
   and `recording.json` holds the raw response, so answer to proposal is
   recoverable. M4 stores `clone(resolutionClaim)` and drops it: 0 of 1,528
   M4 claims retain it. The constraint is satisfiable today and broken at
   one boundary.
8. Every A claim currently carries `auto_pass: false` through an
   unconditional `SOURCE_SCOPE_CERTIFICATION_ABSENT`, and the classifier's
   AI stage appears in 0 of 133 bound runs.

## What the two reviews disagreed about

The first concluded: build A's extractor under B's proof discipline, retire
the generator's matching path, the 1,382 profiles, and the plan to
hand-author about 114 more.

The adversarial review agreed with the direction and rejected it as a
ruling, on these grounds: it reverses `DECISIONS.md` entry 26 Q7 ("additive
three, parser-only facts, no model calls"), taken one day earlier, without
naming it; it skips a two-arm shadow experiment the programme already
recorded as the decision path (`PLAN.md` around 139 to 143, and a Fable
adversarial review dated 2026-08-14); it retires the subtype-profile and
role-schema work, which is in substance the required-role validator that
`DECISIONS.md` entry 18 demands; and "fold Phase B into A" understates that
A lacks the input contract this would require.

Its synthesis, which both reviews can live with, and which matches the
owner's own words: **the model proposes a span and a kind; deterministic
subtype profiles then confirm the required roles are present in that span
or in inherited context, or raise `MISSING_REQUIRED_ROLE`.** That keeps the
roughly 13.5k lines of contract work as a validator layer instead of
retiring it.

## Your task

1. Verify or refute findings 1, 2, 6 and 7 above. They carry the argument.
   Count the cases; do not trust header comments. This repository's most
   expensive and most frequent failure is an agent declaring that something
   does not exist, or that a module only does what its header claims, when
   the code says otherwise.
2. Rule on what should be built once. Say plainly what is kept, what
   becomes a validator rather than an extractor, and what is retired, with
   the line count each decision writes off.
3. Decide whether the two-arm shadow experiment should run first or whether
   the evidence already settles it. If you rule without the experiment, say
   why the recorded decision path is unnecessary, and address that you are
   reversing a decision the owner took on 2026-09-03.
4. Design the contract that lets A serve as proposer inside B's governed
   track: how a new A run enters M4 without a whole-repair reseal; how
   `extraction_provenance` survives to the served fact so the owner can get
   from an answer back to the words and to the proposal; how the required-role
   validators consume A's proposals.
5. Then build it. Follow the repository's own gates: `CI=true npm test`
   (redirect to a file and echo the exit code; never pipe to `tail` or
   `head`, since a pipeline returns the last command's status and will
   report success on a failing suite), `npm run build`, and
   `bash scripts/lint/forbidden-patterns.sh`.

## Constraints you must respect

- Do not rebuild anything that already exists. Search first:
  `grep -rn "name" lib/ scripts/ pages/ tests/` costs seconds, and "nothing
  calls this" is a strong claim that has been wrong here repeatedly.
- The pipeline slices text by UTF-8 bytes everywhere. `indexOf` and `slice`
  count UTF-16 code units. Conversion helpers exist; use them. Confusing the
  two has produced three separate confident false findings.
- A family returning zero results can be correct. An unfinanced deal has no
  guaranty provisions.
- Sealed evidence, registrations and receipts are immutable. Corrections are
  successors; nothing is rewritten or deleted.
- Anything that changes what the owner has to decide, or that reads as a
  legal ruling, is his call and not yours. Bring it to him with the evidence.
- Update a module's header comment in the same change that alters what the
  module does. A stale header is the most authoritative-looking lie in a
  codebase, and this one has several.

## What a good answer looks like

A decision the owner can act on, with the evidence that justifies it, that
finishes one system rather than starting a third; that preserves
deterministic traceability from a served answer back to the exact source
words and to the proposal that produced it; and that is honest about what it
is writing off and what it is reversing.
