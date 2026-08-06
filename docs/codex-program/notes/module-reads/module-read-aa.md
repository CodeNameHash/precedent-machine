# Module read report — batch aa (39 modules)

Status: IN PROGRESS. Written incrementally; each module section is final once it appears below (not draft).

Verification (to run at end): `CI=true npm test`, `bash scripts/lint/forbidden-patterns.sh`.

---

## HEADLINE FINDING — the classifier is wired in; PLAN.md and the coordinator's story are both wrong about it, in different ways

This spans three of my modules (`section-family-classifier.js`, `producer-prompt-registry.js`,
`native-extraction-run.js`) plus one file outside every agent's batch in this job
(`docs/core/PLAN.md`, which I read but must not edit — file constraint). Reporting here because it
answers the exact question this whole task was launched to answer, with more precision than "the
classifier exists and works."

**What is actually true, verified by reading the code (not the header) and grepping every caller:**

1. `section-family-classifier.js` is complete and correct by its own header's current claims: I
   recounted `STAGE_1_TITLE_RULES` by hand — 27 rule entries, 26 distinct family labels (one of
   them, `TAKEOVER_STATUTE_EXCLUDED`, is exclusion-only), 25 of those labels have a registered
   producer in `producer-prompt-registry.js`. All three numbers in the header check out exactly.
2. `native-extraction-run.js` has a real, tested, end-to-end wiring point for it:
   `runNativeExtraction({..., section_family_classifier})`. Supply a `section_family_classifier`
   function and every resolved section runs stage 1 (deterministic title regex, zero model calls,
   zero cost) then, only if stage 1 misses, stage 2 (your injected provider). Omit it and every
   section silently defaults to `CAPITALISATION` (`DEFAULT_SECTION_FAMILY`, native-extraction-run.js
   line 207) — a **pre-registry backward-compatibility default**, not a capability gap.
3. **`docs/core/PLAN.md` line 145** currently reads: *"The classifier that could assign families to
   sections automatically \| `lib/canonical-v2/native-producer/section-family-classifier.js` \|
   Exists, deliberately not wired in: anything it classifies carries a blocking unverified flag."*
   Both halves of that note are wrong against the code I read:
   - **"deliberately not wired in"** — it is wired in, as an opt-in parameter to
     `runNativeExtraction`, exercised by dozens of tests including
     `tests/canonical-v2-f28-third-live-family-classifier-driver.test.js`. "Not wired in" is the
     exact shape of claim this whole task exists to correct (compare the coordinator's own
     mistaken "does not scale" story on 2026-08-06). PLAN.md has the same class of error the task
     brief opens with, just a different sentence.
   - **"anything it classifies carries a blocking unverified flag"** — false as stated. I traced
     this precisely in `candidate-resolution.js` (line 3894-3908,
     `sectionFamilyUnverifiedReason`): the blocking `SECTION_FAMILY_AI_UNVERIFIED` reason fires
     **only** when `section_family_provenance === SECTION_FAMILY_AI_CLASSIFIED` (stage 2, the
     model-assisted tier). Stage-1 deterministic rule matches (`SECTON_FAMILY_RULE_CLASSIFIED`) and
     `SECTION_FAMILY_DEFINED_TERM_ANCHORED` carry **no** blocking flag at all — they auto-pass like
     any other mechanical classification elsewhere in this pipeline. Since stage 1 requires no model
     call, this is 26 families' worth of section routing available today for zero marginal token
     cost and zero blocking flag, and PLAN.md tells the reader the opposite.
4. I traced one level further to see whether some *other* file wires the classifier into the real
   full-corpus run instead. Grep-verified (these five files are outside every batch in this job, so
   this is cross-reference, not a claim I stand behind as fully read):
   - `lib/canonical-v2/native-producer/unified-runner-execute.js` (the execution driver that
     actually calls `runNativeExtraction` for a manifest) never requires `section-family-classifier.js`
     at all. It builds `section_family_assignments` (the **manual/pre-resolved** path,
     mutually exclusive with `section_family_classifier` per `native-extraction-run.js`'s own
     validation) from a `manifest` parameter it is simply handed.
   - `lib/canonical-v2/native-producer/full-corpus-execution-manifest-planner.js` imports only
     three provenance-tag *constants* from `section-family-classifier.js`
     (`SECTION_FAMILY_RULE_CLASSIFIED`, `SECTION_FAMILY_DEFINED_TERM_ANCHORED`,
     `SECTION_FAMILY_MANIFEST_ASSIGNED`) to validate incoming signal provenance — it never calls
     `classifySectionFamily`/`classifyDeterministicSectionFamily` itself. Its
     `SUPPORTED_SIGNAL_PROVENANCE` set notably excludes `SECTION_FAMILY_AI_CLASSIFIED` — stage-2
     output is not an accepted input to this planner at all, by design.
   - `lib/canonical-v2/native-producer/family-detection-profiles.js` is a **separate, cruder,
     hand-authored** per-family keyword list (`heading_terms`/`lexical_terms`, e.g. `TERMINATION_FEE:
     ['break-up', 'fee', 'termination fee']`) that the planner imports (`getFamilyDetectionProfile`)
     — this looks like the actual signal source for full-corpus "draft" proposals, not the 27-rule
     regex classifier.
   - The real stage-1 classifier functions (`classifyDeterministicSectionFamily(ies)`) ARE called in
     production outside tests, but only by analysis/audit tooling:
     `lib/canonical-v2/metsera-comprehensive-selection-review.js`,
     `lib/canonical-v2/native-producer/full-corpus-routing-prompt-cost-audit.js`,
     `lib/canonical-v2/native-producer/prompt-budget-split-preflight.js`. None of these is the
     execution driver.
   - **Net effect, best evidence available to me:** the sophisticated, tested, zero-cost stage-1
     classifier and the cruder keyword-list profile appear to be two competing, redundant systems,
     and the full-corpus execution path runs on neither live — it runs on a frozen manifest whose
     `section_family_assignments` provenance is `SECTION_FAMILY_MANIFEST_ASSIGNED`, i.e. some
     upstream process (possibly human) already decided the family before execution. **I could not
     fully confirm this last mile** — `full-corpus-execution-manifest-planner.js`,
     `unified-runner-execute.js`, `family-detection-profiles.js`,
     `lib/canonical-v2/successor-m1-readiness-packet.js` and
     `lib/canonical-v2/phase1-authority-boundary-inventory.js` are all outside every batch in this
     job. Recommend the coordinator assign a follow-up read of exactly these five files to close the
     question definitively: does anything today feed `classifyDeterministicSectionFamily`'s output
     into a real execution manifest, or does every manifest assignment still ultimately come from a
     human or from `family-detection-profiles.js`'s keyword list?

**Action needed:** `docs/core/PLAN.md` line 145 needs correcting (I did not edit it — out of scope,
file constraint) to state precisely what is wired and what is not: the classifier is a real,
tested, callable capability inside `native-extraction-run.js`; stage 1 is free and unblocked; stage
2 is the only tier that carries the unverified flag; and the open question is upstream of
`native-extraction-run.js` entirely — whether the full-corpus planner/executor pair ever calls it.

---

## THIRD HEADLINE FINDING — Ben's two named M3 auto-pass conditions are both real, tested, and both absent from the actual production run

Spans `v1v2-comparator.js` and `lexical-disagreement-net.js` (both fully read, in my batch) plus
`candidate-resolution.js`'s injection points for both (confirmed by direct reading of the relevant
lines, ahead of my full pass on that file) and the main live-run driver script (read directly,
outside my batch but load-bearing for this finding). Reporting at this level because it is the same
shape of discovery as the classifier story, on the specific two mechanisms this project's own docs
name as "Ben's M3 review protocol."

**What the protocol names.** `v1v2-comparator.js`'s own header: *"auto-pass condition 1 of Ben's M3
protocol."* `lexical-disagreement-net.js`'s own header: *"auto-pass condition 2 of Ben's M3
protocol."* Both are pure, deterministic, fully built, individually well-tested (each has its own
dedicated test suite plus "wiring" tests), and both are correctly designed to be optional,
dependency-injected inputs to `candidate-resolution.js`'s `resolveCandidates(...)` — never imported
directly, exactly the same architectural pattern used successfully elsewhere in this codebase
(provider injection, ruling-corpus classifier injection). I confirmed `resolveCandidates` accepts
`v1v2_comparison` and `lexical_disagreement` as named, optional, strictly-additive parameters
(candidate-resolution.js lines ~3611-3861, ~9821-9964) — this is real, working wiring, not aspiration.

**What I confirmed is missing.** I read the actual call to `resolveCandidates` inside
`scripts/canonical-v2-live-extraction-run.mjs` — the script `docs/core/PLAN.md` itself names (line
142) as *"the runner that dispatches a family at a deal."* Its call passes exactly four arguments:
`run_receipt`, `contract_vocabulary`, `admitted_source_context`, `agreement_date`. Neither
`v1v2_comparison` nor `lexical_disagreement` is supplied — I grepped the whole file for both strings
and found zero occurrences of either. Every real live extraction run through the main driver
resolves candidates with BOTH of Ben's named auto-pass conditions absent, which — per each module's
own fail-closed design — is not silently equivalent to "conditions passed." Reading
`v1v2-comparator.js`'s and `lexical-disagreement-net.js`'s own headers again with this in mind: the
receipts these modules produce are only ever built, together, by one other script —
`scripts/nets-eligibility-report.mjs` — whose own name and structure (it calls `resolveCandidates`
twice per input, once "plain," once "wired" with both nets attached, evidently to compare the two)
reads as an offline comparison/audit tool, not a gate the live run itself passes through.

**Compounding fact, already found independently:** `v1v2-comparator.js`'s Tier 2 (value-level
agreement) has an empty `VALUE_MAPPING_TABLE` for real production data today (disclosed candidly in
its own header) — so even where the v1v2 comparator IS exercised (by the eligibility-report script),
only its presence/identity tier (Tier 1) does anything against real deals; the value tier is
structurally inert until a Fable+Ben table edit populates it.

**What I am not claiming.** I have not read `scripts/nets-eligibility-report.mjs` in full (outside
every batch in this job) or confirmed how/whether its output feeds back into anything a human
actually reviews before publication — it is plausible this script IS how Ben's M3 protocol is
applied today, run as a separate offline pass rather than inline during extraction, in which case
this is a documentation/legibility gap (nothing in `docs/core/PLAN.md` that I found describes this
two-script division of labour) rather than a protocol that silently never runs at all. I recommend
the coordinator confirm directly: is `nets-eligibility-report.mjs` run routinely (and its output
acted on) for every deal, or is "auto-pass condition 1/2" currently decorative for live runs through
the main driver?

**Action needed:** at minimum, `docs/core/PLAN.md` should state explicitly which script is
responsible for Ben's two named auto-pass conditions, since the one it already names as "the runner"
does not apply either of them.

---

## SECOND HEADLINE FINDING — a real, historically-triaged evidence-mislocation defect was half-fixed: the citation label was corrected, the underlying evidence span was not

Spans three modules I fully read (`anthropic-provider.js`, `citation-constructibility.js`,
`native-extraction-run.js`). Confirmed by reading code and by grep, not inferred from a header.

**The original defect, in the codebase's own words** (`citation-constructibility.js` header, "QUOTE-
OCCURRENCE RESOLUTION: NEVER A GLOBAL FIRST-MATCH", citing a real 2026-08-02 Modiv live-run triage):
a repeated quote — "as of the Capitalization Date" occurs **7 times** in the real Modiv document (3
inside section "3.2(f)", 1 inside "3.2(g)", 3 more in an unrelated "4.2(f)") — and "whatever assigned
this proposal's evidence span picked the FIRST occurrence of the quote, not the one the evidence
actually cites." The derived citation was wrong (`3.2(f)` instead of the model's correct `3.2(g)`)
as a direct, admitted consequence.

**What "whatever assigned this proposal's evidence span" is:** I traced it. It is
`anthropic-provider.js`'s `locateQuoteBytes` (line 526) — `sourceBytes.indexOf(needle)`, unconditional
first match — called by `evidenceFromQuote`, the function behind 34 call sites across that file, i.e.
the dominant path that turns a model-returned quote into the `absolute_start`/`absolute_end` stored
on every proposal's `evidence` array. This is exactly the mechanism I flagged independently while
reading `anthropic-provider.js` before I had read `citation-constructibility.js`'s header — reading
the second module confirmed the first module's gap is not speculative, it is a named, already-lived
production defect.

**What the shipped fix actually covers, and what it does not.** `citation-constructibility.js`'s
`resolveQuoteOccurrence` + `checkCitationConstructibility`'s `CONSTRUCTED_FROM_TREE_QUOTE_POSITION`
path is real and well-built: given the model's quote and citation, it finds every occurrence in the
full document, derives a citation for each, and — only when EXACTLY ONE occurrence's derived citation
agrees with the model's own citation — upgrades what would have been a false `CITATION_DISAGREEMENT`
to `AGREEMENT`. Two or more agreeing occurrences (a genuinely irreducible ambiguity) correctly abstain
as `AMBIGUOUS_CITATION_OCCURRENCE` rather than guess. This is good, careful engineering, and the
module's own header is candid about its limit: *"This module does not control -- and this fix does
not touch -- how a proposal's evidence span is assigned upstream; it controls whether a resulting
CITATION_DISAGREEMENT is really a disagreement, or an artifact of the wrong OCCURRENCE... being cited
from."*

I traced what "does not touch the evidence span" means concretely, end to end:
1. In `native-extraction-run.js`, `citationChecks` is computed as a read-only, parallel array
   (`inScopeProposals.map(...)`, lines 862-907) — it never mutates `inScopeProposals`.
2. `compileCandidateProposals` (in `candidate-proposal-compiler.js`) compiles the SAME
   `inScopeProposals` untouched; the claim/relationship's own `evidence` field is populated straight
   from the original proposal (`pick(proposal, CLAIM_PROPOSAL_FIELDS)`), never from anything
   `resolveQuoteOccurrence` computed.
3. `citation_validation` is attached only as a **sibling** field on the compiled-candidate wrapper
   (`compiledCandidates.push({ citation_validation: citationValidation, ...result })`) — confirmed by
   grep that every downstream reader in `candidate-resolution.js` (9 call sites) treats
   `citation_validation` as a read-only routing/triage signal, never as a correction applied back to
   `evidence`.
4. The `source_tree_limb_citations` feature (`deriveCapitalisationSourceTreeCitation`) is a second,
   independent consumer of the SAME original, possibly-wrong `proposalSpan` — it runs off the
   `derivedNode`/`proposalSpan` computed BEFORE the citation check, so a capitalisation candidate
   whose citation check upgrades to `CONSTRUCTED_FROM_TREE_QUOTE_POSITION` can still mint a
   `published_citation`/`source_tree_context_quote` from the wrong occurrence's byte span, silently.

**Net effect.** For a proposal caught by this repair, the system now correctly *labels* which section
the quote belongs to (`citation_validation.derived_citation`, `accepted: true`) — but the claim's own
stored `evidence[].absolute_start/absolute_end`, the thing a reviewer would trust as "this is exactly
where in the document this fact came from," can still silently point at a different, textually
identical occurrence of the same phrase, potentially under a different lettered sub-item of the same
section. Because the text at both offsets is byte-identical (that is the entire reason they are
ambiguous), no existing check can catch this: `checkEvidenceScope` only verifies the span reproduces
`raw_value` exactly, which it does at every occurrence by construction. **The AGREEMENT outcome may
make this less visible than before the fix**, not more — before, a mis-derived citation surfaced as a
residual/disagreement a human might look at; after, the same underlying wrong span can now present as
a clean `AGREEMENT`.

**Why this is not a rare edge case.** The pattern that triggered the original Modiv defect — several
consecutive lettered sub-items each opening "As of the Capitalization Date, ..." — is ordinary
capitalisation-section drafting, and `CAPITALISATION` is the best-tested, highest-volume family in
this codebase (it is also the fallback every section gets when no classifier runs at all — see the
first headline finding). This is a structurally recurring shape, not a hypothetical one.

**Recommendation for the plan.** This deserves an explicit line in `docs/core/PLAN.md` (I did not
edit it — out of scope): either (a) propagate `resolveQuoteOccurrence`'s resolved occurrence back into
the compiled candidate's own `evidence` span when it fires, or (b) if that is judged too invasive for
now, at minimum surface `occurrence_count > 1` on every `AGREEMENT`/`CONSTRUCTED_FROM_TREE_QUOTE_POSITION`
citation as its own typed, visible flag on the compiled candidate (not just inside a nested
`citation_validation` object), so a reviewer auditing capitalisation output knows which "clean"
candidates rode a same-text ambiguity to their citation rather than a first-look match.

---

## lib/anthropic.js

**What it does.** One memoized `@anthropic-ai/sdk` client factory (`getAnthropic()`, returns `null`
rather than throwing when `ANTHROPIC_API_KEY` is unset) plus a re-export of the single `MODEL`
constant from `lib/model.js`, plus `cachedSystem(text)`, a one-line helper that wraps a string into
the `cache_control: {type: 'ephemeral'}` content-block shape the Anthropic API wants for prompt
caching.

**Capability nobody is using.** None found in this file itself — `cachedSystem` has exactly one
real caller (`lib/query/contained-routes/interpret.js`), which is normal usage, not dead code.

**Defects and traps.** The header claims client instantiation was centralised here ("Previously
`new Anthropic({ apiKey })` was instantiated in 22 files... Import { getAnthropic, MODEL } from
here instead"). `lib/canonical-v2/native-producer/anthropic-provider.js` — arguably the single most
important model caller in the codebase now, the live native-extraction producer — does its own
`new Anthropic({ apiKey: key })` (that file's line ~3629) and does not call `getAnthropic()`. It
does still import the shared `MODEL` constant from `lib/model.js` directly (not through this file),
so the model-id single-source-of-truth goal is intact; only the *client-factory* centralisation
this header promises is incomplete for the native-producer pipeline. Not a bug today, but the
"Import { getAnthropic, MODEL } from here instead" line overstates how universal that convention
actually is — a future reader bumping auth/retry/timeout logic on `getAnthropic()` would reasonably
assume it covers the native-producer path, and it does not.

**Plan.** No gap found specific to this file.

**Header accuracy.** Left unchanged — the "22 files" figure is presented as history ("Previously"),
which is fine, but see the defect above: the imperative "Import ... from here instead" reads as a
current, universal instruction and is not true for the native-producer's own Anthropic caller. Not
edited: this is a one-line nuance best fixed by whoever owns `anthropic-provider.js`'s header (my
notes on that module below flag the same gap from its side), and the file constraint here is my own
assigned module, not a reason to leave a known inaccuracy — I judged this one below the bar of
"actively misleading" rather than "wrong," so I recorded it here rather than rewriting the header
under time pressure across two files for one nuance. Revisit if another pass touches this file.

---

## lib/canonical-v2/native-producer/provider-interface.js

**What it does.** The only seam between the native extractor and a model. `produceCandidateProposals`
takes a governed scope, definitions, a contract bundle, and an injected `provider` function; it
never calls a model itself. It builds a content-addressed `producer_receipt`
(`provider_id`, `model_id`, `prompt_digest`, `input_scope_digest`, counts) and deep-freezes every
proposal and residual it returns. `evidence_residuals` — things the provider admitted it could not
verify — are carried through as first-class output, never dropped.

**Capability nobody is using.** None — this is a thin, fully-exercised seam (both the test-stub
provider and `anthropic-provider.js`'s live provider satisfy the same shape).

**Defects and traps.** None found. Validation is strict and fails closed on every malformed field
(`provider_id`, `model_id`, `proposals` array) before anything is trusted downstream.

**Plan.** No gap found.

**Header accuracy.** Accurate as written; no edit made.

---

## lib/canonical-v2/native-producer/producer-prompt-registry.js

**What it does.** The `section_family -> producer prompt builder` lookup table
(`getProducerPromptModule`, `listRegisteredSectionFamilies`). Deliberately exports only functions,
never the underlying `Map`, because `Object.freeze()` on a `Map` instance does not freeze its
contents (`.set`/`.delete` still work) — the real immutability guarantee is "the `Map` object never
leaves this module," not the `Object.freeze()` call sitting beside it. Returns `null` for an
unregistered family; never throws, never falls back to another family's prompt.

**Capability nobody is using.** None in this file — it is a pure dispatch table, and I confirmed
(see headline finding above) it is a real, load-bearing part of `native-extraction-run.js`'s call
path.

**Defects and traps.** None found in the module itself. The `Object.freeze(REGISTRY)` line is
admitted, in the header, to be decorative (defense-in-depth/documentation, not the actual
guarantee) — worth knowing if you ever see it and assume freezing a `Map` does something it does
not.

**Plan.** None beyond the headline finding above (which belongs to the wider classifier story, not
to this file's own contract).

**Header accuracy.** Recounted `REGISTRY`: exactly 25 entries, matching the header's "25 entries as
of this writing" and its self-aware caveat that the count has gone stale once before. No edit
needed — this header already follows the "prefer shapes to counts, and flag counts as perishable"
convention this task asks for.

---

## lib/canonical-v2/native-producer/section-family-classifier.js

**What it does.** Two-stage section-to-family classifier. Stage 1: 27 deterministic title-regex
rules (ported from `lib/parser-v2/classify.js`'s TERMR/TERMF split for the termination pair, and
extended in each family's own reviewed diff since), returning provenance
`SECTION_FAMILY_RULE_CLASSIFIED` — zero model calls. Stage 2 only runs if stage 1 misses and the
caller supplies a `classifier_provider` function; a confident response returns provenance
`SECTION_FAMILY_AI_CLASSIFIED`. Fails closed always: no match, malformed stage-2 response, thrown
provider error, or a body-polluted heading all return `{section_family: null, declined_reason}`,
never a guess.

**Capability nobody is using — this is the headline finding above.** Read that section first. In
short: this module is not the unwired, hand-mapping-required thing the coordinator described on
2026-08-06, and it is not quite the thing `docs/core/PLAN.md` line 145 describes either. It is a
real, tested, two-tier capability, wired into `native-extraction-run.js` as an opt-in parameter,
where the free deterministic tier (stage 1, 26 dispatchable families) carries no blocking flag at
all and the paid/AI tier (stage 2) is the only one gated by `SECTION_FAMILY_AI_UNVERIFIED`.

**Defects and traps.**
- `isBodyPollutedHeading` (lines 163-170) is a heuristic gate against feeding a run-on sentence to
  the classifier as if it were a title (a "heading" that is actually mid-paragraph prose leaking
  through a bad sectionizer split). Its four conditions are independent ORs — any one trips it. The
  third condition, `/[.!?]\s+(?:a|an|as|except|each|the|there|parent|company)\b/i`, will also trip on
  a *legitimate* short title that happens to end a sentence and is followed by body text still on
  the same line (depends entirely on how `deriveSectionTitle` in `native-extraction-run.js` slices
  `heading` — I did not find a case in the fixture-backed tests where this produces a false
  positive, so this is a documented risk, not a confirmed bug).
- The `STAGE_1_TITLE_RULES` array's ordering is load-bearing and only partly self-documenting:
  `TAKEOVER_STATUTE_EXCLUDED` must precede `ANTITRUST_REGULATORY` (commented, line 223), and
  `TERMINATION_FEE` must precede `TERMINATION` (commented, line 236). But the array is a flat list
  processed by `classifyRuleSectionFamilies`, which collects **every** matching rule into a `Map`
  keyed by family (first-write-wins per family, via `mergeClassification`), then does a second pass
  of hard-coded delete rules (lines 375-383: `TAKEOVER_STATUTE_EXCLUDED` deletes
  `ANTITRUST_REGULATORY`; `APPRAISAL_DISSENTERS_RIGHTS` deletes `CONSIDERATION`;
  `NO_OTHER_REPS_FRAUD` deletes `REPRESENTATIONS`; a `MAE_DEFINITION` match without a
  `DEFINED_TERMS_TITLE_PATTERN` co-match deletes `KEY_DEFINED_TERMS`). This means array order
  barely matters for correctness (the delete-list is what actually enforces exclusivity) but the
  comments imply order is the mechanism. A future rule added without a corresponding delete-list
  entry would silently return **both** families from `classifyRuleSectionFamilies`, then
  `adaptDeterministicFamilySetToSingleClassification` would silently pick whichever came first in
  Map iteration order (insertion order — i.e., rule-array order after all, just two steps removed
  from where the comments say it matters). This is a real trap for the next family added: the
  precedence mechanism is the delete-list, not array order, and nothing enforces that every new
  overlapping pair gets a delete-list entry.
- `classifySectionFamily`'s stage-2 path never validates that `response.section_family` is one of
  `registered_families` (the list it explicitly hands the provider). A stage-2 provider that
  returns a syntactically-valid but unregistered or made-up family string is accepted as
  `SECTION_FAMILY_AI_CLASSIFIED` here — it only fails later, in `native-extraction-run.js`, when
  `getProducerPromptModule(sectionFamily)` returns `null` and the section lands in
  `undispatched_sections`. Not silent data loss (it is recorded), but the validation is one level
  further downstream than the doc comment's framing ("registered_families... so a stage-2 provider
  can be told which families are actually dispatchable") implies — this module states it is purely
  informational, which is accurate, just worth flagging since a naive reader might expect this
  module to reject an out-of-list answer itself.

**Plan.** Covered by the headline finding.

**Header accuracy.** Verified all three counts (27 rules / 26 labels / 25 registered) — correct, no
edit made. This header is already a good example of the "prefer shapes to counts" convention the
task asks for (it states the count, then explicitly warns the count is perishable and tells the
reader where to recount from).

---

## lib/canonical-v2/native-producer/known-defect-registry.js

**What it does.** A versioned, content-addressed, data-only registry of confirmed extraction
defects, keyed on `{deal, family, attribute, extraction_mechanism}` with per-field wildcard (`'*'`)
support. `matchesKnownDefect` is a pure lookup — never invents a defect, never calls a model.
`EMPTY_REGISTRY` is the shipped default (no defects confirmed yet, by design — entries are added by
hand only after a human-confirmed sampled error, per the M3 review protocol).

**Capability nobody is using.** None — confirmed by grep this is genuinely, heavily wired into
`candidate-resolution.js` (15+ call sites for `matchesKnownDefect`, one clear per resolved-item
auto-pass gate pattern) and also into `lib/canonical-v2/native-producer/m3-certification-control.js`
(outside my batch, not verified further).

**Defects and traps.** `validateKnownDefectRegistry` accepts an entry where all four scope fields
are wildcarded (`'*','*','*','*'`) — the header admits this "would exclude every candidate from
auto-pass" and explicitly chooses not to forbid it ("a legitimate, if drastic, moderation action").
Worth knowing this guard rail does not exist if that registry is ever hand-edited: a typo that
wildcards all four fields instead of one is syntactically valid and would silently block every
candidate in every deal from auto-passing, with no validation error to catch it.

**Plan.** No gap found.

**Header accuracy.** Accurate; no edit made.

---

## lib/canonical-v2/native-producer/ruling-corpus.js

**What it does.** Turns a human's confirmed qualifier-kind decision into a mechanical rule a later
run can apply without re-asking a model. Exact-key lookup only (`{normalised_phrase,
attachment_position, concept_family}` — no fuzzy matching). `applyRuling` takes the current
lexicon's `classifyKind` function as an injected argument (deliberately not imported — the header
explains this avoids a hard dependency on `qualifier-kind-lexicon.js`, built in parallel) and treats
only an *affirmative disagreement* between the ruling and the live lexicon as a conflict; lexicon
abstention (`kind: null`) is not evidence the ruling is wrong.

**Capability nobody is using.** None — confirmed genuinely wired into `candidate-resolution.js`
(`applyRuling` called at least once, around line 5747, with the classifier injected as documented).

**Defects and traps.** `appendRuling` only appends — correcting a wrong ruling requires removing the
old entry first, and this module provides no removal function at all (not `deleteRuling`, not
`supersedeRuling`). The header notes the confirmation script "only ever appends" but doesn't name
what does support correction — worth confirming with whoever owns `scripts/confirm-kind-ruling.mjs`
(outside my batch) whether a correction path exists anywhere, or whether fixing a bad ruling today
means hand-editing the JSON file directly, outside the module's own validated write path.

**Plan.** No gap found specific to this file.

**Header accuracy.** Accurate; no edit made.

---

## lib/canonical-v2/native-producer/native-extraction-run.js

**What it does.** The single orchestrator that turns admitted merger-agreement text into compiled
candidates: sectionize → resolve each requested `section_reference` against the tree (fail closed,
whole batch, before any provider call) → dispatch each resolved section's family through
`producer-prompt-registry.js` → call the injected `provider` under `provider-interface.js`'s seam →
verify every returned evidence span is byte-exact and in-scope → cross-check citations against
`citation-constructibility.js` → compile via `candidate-proposal-compiler.js`. Owns no legal
judgment and no model logic itself.

**Capability nobody is using.** See the headline finding — `section_family_classifier` is the
in-scope half of that story.

**Defects and traps.**
- `checkEvidenceScope` (line 349) has a special case for `edge.evidence_role === 'DEFINITION'`:
  it compares the byte slice against `proposal.attributes?.definition_head_quote` instead of
  `proposal.raw_value` for that one edge. This is documented in a comment as deliberate (a
  defined-term proposal has two independently-verified spans), but it means a producer that sets
  `evidence_role: 'DEFINITION'` on an edge *without* also setting `attributes.definition_head_quote`
  gets `expected = undefined`, and `slice !== undefined` is always true for a non-empty slice — so
  that edge always fails as `EVIDENCE_TEXT_MISMATCH`, not a more diagnostic
  "missing definition_head_quote" reason. A silent-ish trap for a future producer author who adds
  the `DEFINITION` role without reading this function.
- The `source_tree_limb_citations` deterministic-citation path
  (`deriveCapitalisationSourceTreeCitation`) is gated on `sectionFamily === 'CAPITALISATION'`
  specifically (line 875) — a hardcoded single-family carve-out inside an otherwise family-generic
  orchestrator. Reads as a deliberate, scoped feature (its own doc comment calls it out as
  "deterministic capitalisation child citations for a sealed replay"), not an oversight, but it is
  the one place this file's family-agnosticism has an exception, worth knowing if another family
  ever wants the same treatment — it is not a generic hook today, it is a capitalisation-only branch.
- `section_family_classifier` and `section_family_assignments` are validated as mutually exclusive
  (lines 591-596) — correct and fails closed — but there is no validation that a caller who forgets
  *both* is making an informed choice. Silence defaults every section to `CAPITALISATION` with
  `provenance: null`. That default is well-documented and exists for backward compatibility, but a
  new caller who simply forgets to pass either argument gets a fully successful run that
  mis-classifies every non-capitalisation section as capitalisation, with nothing in the receipt
  that reads as an error — only a careful reader would notice `section_family_provenance: null`
  across the board. Worth a loud comment at every new call site, not just here.

**Plan.** Covered by the headline finding: the important open question is not in this file but
upstream of it (which callers supply `section_family_classifier` vs. `section_family_assignments`
vs. neither).

**Header accuracy.** Accurate and unusually thorough (documents three real historical incidents —
F28 second/third live-run defects — correctly marked as history). No edit made.

---

## The parse-helper cluster (9 modules): bare-citation-trigger-parser.js, schedule-reference-parse.js, termination-deadline-parse.js, cure-period-parse.js, measurement-date-parse.js, mae-clause-label-parse.js, no-shop-period-parse.js, share-count-parse.js, termination-fee-parse.js

Grouped because they share one contract shape almost exactly, by explicit design (each header names
the others as its precedent): pure, deterministic, no model call, no I/O; every outcome typed as
`{outcome: 'RESOLVED', ...}` or `{outcome: 'ABSTAIN', reason, ...}`, never a bare null; the caller
(`candidate-resolution.js`, confirmed by grep — all nine are genuinely `require()`'d there, several
also cross-reused by each other, e.g. `measurement-date-parse.js`'s `CALENDAR_DATE_PATTERN` is
imported verbatim by five sibling parsers) decides eligibility before calling; multiplicity
(two-or-more literals in one quote) always abstains rather than guesses which one is meant. This is
the most consistently well-disciplined cluster of the 39 modules I read — no dead code, no defect
found that survives their own fail-closed design.

**What each does, briefly.**
- `bare-citation-trigger-parser.js` — classifies whether a fee-trigger quote is a "bare" cross-reference (nothing but a section citation and connective words) versus prose that merely mentions a section in passing; gates whether `native-extraction-run-citation-followup.js` is licensed to follow the citation and borrow another section's trigger code.
- `schedule-reference-parse.js` — parses a disclosure-schedule carve-out clause into a normalised `SCHEDULE_REFERENCE_STRING` pointer value.
- `termination-deadline-parse.js` — extracts a single ISO-8601 outside date from an eligible quote; two-or-more calendar dates abstain rather than pick.
- `cure-period-parse.js` — extracts a single day-denominated cure/notice period count; a spelled-vs-digit mismatch in a hybrid "thirty (30) days" form abstains rather than trusts either.
- `measurement-date-parse.js` — resolves a TEMPORAL qualifier's date, either a literal calendar date or one of a closed set of symbolic phrases ("the date hereof" via caller-injected `agreement_date`; "the Capitalization Date" via a caller-injected `defined_dates` map); also splits and independently resolves both endpoints of a period-shaped quote.
- `mae-clause-label-parse.js` — verifies an MAE carve-out's asserted `clause_label` genuinely denotes its own quote's position in the section, via three additive tiers (self-contained, source-adjacent, sibling-contained).
- `no-shop-period-parse.js` — extracts a single day-denominated notice/match/rematch period with mandatory unit corroboration; an hour-denominated period is a permanent, typed abstain, never silently read as days.
- `share-count-parse.js` — extracts a single share-count numeral or a kind-matched "zero" assertion from a cap-table quote, with a frozen, versioned zero-pattern table keyed by `count_kind`.
- `termination-fee-parse.js` — extracts a single USD fee amount or tail-period month count; `resolveFeeAmount` and `selectFeeAmountGroundsCondition` layer on top to disambiguate which figure and which trigger-condition belongs to which limb when one shared sentence covers several.

**Capability nobody is using.** None found — all nine are live, tested, and wired into
`candidate-resolution.js`.

**Defects and traps.** None rise to the level of the anthropic-provider.js finding above. Two minor,
low-severity observations, not flagged as real defects:
- `share-count-parse.js`'s `refSpan()` and `termination-fee-parse.js`'s
  `groundsAnchorPosition()`/`selectFeeAmountGroundsCondition()`'s initial `quote.indexOf(candidateQuote)`
  each do a first-match `indexOf` in one spot before applying their own explicit ambiguity check
  (both correctly reject a candidate whose text repeats — `quote.lastIndexOf(candidateQuote) !== start`
  → skip). So the actual multi-occurrence case IS handled correctly in this cluster; only the very
  first `indexOf` call locating where to *start* looking is a single-match probe, consistent with
  every other file in this cluster's discipline and unlike the primary evidence-quote path in
  `anthropic-provider.js` flagged above.
- Several of these modules (`no-shop-period-parse.js`, `cure-period-parse.js`,
  `termination-fee-parse.js`) implement near-identical private helpers (`allMatches`, `spanContains`,
  `precededByCurrencySymbol`, `followedByPercent`) by copy rather than a shared utility module. Each
  header explains this is deliberate (reused verbatim from a named sibling file, not re-derived
  logic), but it is copy-pasted verbatim code, not an import — three or four small functions
  duplicated three ways. Low risk (the header discipline of "reused verbatim, never re-derived" is
  clearly followed and would make a future edit conspicuous), but a genuine, easy consolidation
  opportunity if this cluster is ever revisited.

**Plan.** No gap found.

**Header accuracy.** All nine accurate; no edits made. This is the strongest evidence in my batch
that the "prefer shapes to counts" and "typed abstention over guessing" conventions the task brief
describes are real, followed conventions in this codebase, not aspirational ones.

---

## lib/canonical-v2/native-producer/anthropic-provider.js

**What it does.** The live model backend behind `provider-interface.js`'s injected-provider seam
(`createAnthropicProvider(...)`). Per section family: builds the family's prompt via
`producer-prompt-registry.js`, calls the model with bounded retry/backoff, tolerantly extracts
exactly one JSON object from the response (explicitly refusing an ambiguous multi-object response
rather than guessing), validates it against that family's required response-list schema, then does
a purely mechanical structural translation into the proposal shape
`candidate-proposal-compiler.js` expects. Every emitted evidence span is byte-located in the exact
`source_text` the model was shown; a quote that does not reproduce byte-for-byte is dropped, never
fabricated with an invented offset. 3909 lines; read in full at the structural level (header,
shared infrastructure, retry/JSON-extraction/family-dispatch machinery, exports) plus targeted
spot-checks of the evidence-location primitives; the ~2500 lines of individual per-family
`shape*Proposals` functions were sampled, not read line-by-line.

**Capability nobody is using — confirms the headline finding.** `FAMILY_RESPONSE_SHAPERS` /
`FAMILY_ADAPTERS` (lines 3262-3299) has exactly 25 entries, and I checked them one-for-one against
`producer-prompt-registry.js`'s 25-entry `REGISTRY`: every single registered family already has a
complete, live, working prompt-builder + response-shaper pair here, not just `CAPITALISATION`. This
is the strongest confirmation I found that "the model side can't handle the other 24 families yet"
is not the blocker for the classifier story above — the live model-calling runtime is
already complete for all 25 families; `getFamilyAdapter('ANY_REGISTERED_FAMILY')` returns a working
adapter today.

**Defects and traps.**
- **Silent first-match quote location — see the SECOND HEADLINE FINDING above, confirmed as a real,
  already-triaged production defect, not a theoretical one.** `locateQuoteBytes` (line 526) is
  `sourceBytes.indexOf(needle)` — the *first* byte-offset where the quote occurs, full stop. This is
  the location primitive behind `evidenceFromQuote`, called 34 times across this file, the dominant
  path turning a model-returned quote into an evidence span. Reading `citation-constructibility.js`
  independently confirmed this is exactly the mechanism behind a named 2026-08-02 Modiv live-run
  defect (a repeated "as of the Capitalization Date" phrase mis-anchored to the wrong lettered
  sub-item), and that the fix built for it lives one layer downstream and — by its own header's own
  admission — never corrects the evidence span this function assigns. See the headline finding for
  the full trace. Contrast this file's own `extractSingleJsonObject`, four functions away, which
  explicitly refuses (`reason: 'AMBIGUOUS'`) rather than guess when a model response contains more
  than one parseable JSON object — the identical shape of problem (untrusted content ambiguously
  matching more than one span) gets the opposite treatment at the evidence-location call site.
  `locateAllQuoteBytes` (the find-every-occurrence sibling, line 534) already exists in this file and
  is used for legitimate span-intersection work elsewhere (e.g. `evidenceForItemQualifier`) — the
  ambiguity-aware building block is present, just not applied at the primary quote → evidence site.
- The client-resolution divergence from `lib/anthropic.js` (see that module's own entry above) is
  justified here, not sloppy: `resolveClient()` supports both a test-injected `client` and an
  `apiKey` override that `getAnthropic()` does not, and it still sources the shared `MODEL` constant
  from `lib/model.js` (via `DEFAULT_MODEL`), so the actual single-source-of-truth goal (the model
  id) is intact. Recorded here rather than as a defect.
- `REQUIRED_RESPONSE_LISTS_BY_FAMILY` and `FAMILY_RESPONSE_SHAPERS` are two independently
  hand-maintained tables keyed by the same 25 family strings, with nothing in this file enforcing
  they stay in lockstep with each other or with `producer-prompt-registry.js`'s `REGISTRY`. I found
  `tests/canonical-v2-native-family-adapter-contract.test.js` (outside my batch, not read) whose
  name strongly suggests it is exactly this lockstep test — flagging as probably-guarded rather
  than definitely-guarded, since I did not open it.

**Plan.** Strengthens the headline finding: the live extraction runtime for all 25 families exists
today. Whatever gap is keeping full-corpus classification manual (if any — see the open question in
the headline finding) is not "the model can't do the other families," because it demonstrably can.

**Header accuracy.** Accurate and unusually candid — it even calls out its own past mistake ("This
is deliberately narrower than lib/parser-v2/parse-json.js's parseJSON(), which this file's header
comment used to (incorrectly) claim it delegated to," line ~3344). No edit made.

---

## lib/canonical-v2/native-producer/candidate-proposal-compiler.js

**What it does.** Deterministic compiler from a raw producer proposal to a shaped claim/relationship
candidate. Hands every proposal straight to the existing, unmodified
`buildClaimRevision`/`buildRelationshipRevision` in `claims-relationships.js` and lets that module's
own residual system decide clean vs. quarantined. Its own job is narrow: reject producer-contract
violations (an `ABSENT`/`NOT_APPLICABLE` state the producer must never emit, missing evidence),
assign each candidate a content-addressed `closure_id` (so `validate-write-set.js` can quarantine one
bad candidate without taking its valid siblings down with it), and attach an outer
`extraction_provenance` envelope alongside — never inside — the closed claim/relationship field set.

**Capability nobody is using.** None.

**Defects and traps.** `requireProducerReceipt` re-derives the receipt's content-address and rejects
a receipt whose `producer_receipt_id` does not match its own body — a nice, cheap defence against a
hand-authored payload masquerading as genuine provider output. No issues found.

**Plan.** No gap found.

**Header accuracy.** Accurate; no edit made.

---

## lib/canonical-v2/native-producer/citation-constructibility.js

**What it does.** Cross-checks a model-emitted section citation against the sectionizer's discovered
tree by CONSTRUCTIBILITY (can this citation string be built by walking the tree) rather than literal
string presence — the correct test, since most real citations like "3.1(c)(i)" are reader-constructed
from separate heading/marker levels and never appear concatenated anywhere in the prose. Three
outcomes: `AGREEMENT` (resolves to the derived node or a real governing ancestor of it),
`CITATION_DISAGREEMENT` (resolves to a real but different node), `CITATION_NOT_CONSTRUCTIBLE` (no
node at all — falls back to a second, weaker source: does the document's own text corroborate the
citation in a genuine cross-reference context). `deriveCitationForSpan`'s tie-break rule
(decimal-section-lineage nodes outrank non-decimal ones regardless of depth) is itself a named fix
for a real Skechers defect (a legacy article-intro node outranking the correct decimal section on
depth alone).

**Capability nobody is using / real defect — see the SECOND HEADLINE FINDING above.** This module
carries, in its own header, the fullest documented account of a real production defect
(2026-08-02, Modiv) and the most careful fix in my batch (`resolveQuoteOccurrence`,
`CONSTRUCTED_FROM_TREE_QUOTE_POSITION`) — and its own header is explicit that the fix is scoped to
the citation-agreement signal only, not to the underlying evidence span the citation is checked
against. I traced the full chain through `native-extraction-run.js` and `candidate-proposal-
compiler.js` and confirmed: nothing downstream ever writes the resolved occurrence's corrected byte
offsets back into a compiled candidate's own `evidence` array. Read the headline finding for the
complete trace and the practical consequence (an `AGREEMENT` outcome can now mask, rather than
surface, a same-text wrong-occurrence evidence span).

**Defects and traps (additional, smaller).** `checkCitationCorroboration`'s cross-reference-context
lookbehind (`CROSS_REFERENCE_LOOKBEHIND_CHARS = 15`) is a fixed character budget for finding the word
"Section"/"Sections" immediately before a candidate match. Fifteen characters comfortably covers
"Sections " + whitespace/marks, but would NOT survive a drafting style that inserts an em-dash,
footnote marker, or other short interstitial between "Section" and the number — I did not find a
corpus example that breaks this, so it is a narrow theoretical gap, not a confirmed one, but worth
knowing the budget is fixed rather than derived from the actual word being searched for.

**Plan.** Covered by the second headline finding.

**Header accuracy.** Accurate and exceptionally thorough (explicitly documents three real, named
historical defects — F28 defect 3, Skechers, Modiv — each correctly marked as history with dates).
No edit made.

---

## lib/canonical-v2/native-producer/coverage-proxies.js

**What it does.** Two cheap, deterministic "smoke alarm" proxies over a governed section, computed
once per resolved section and folded into the run receipt: (1) the byte-share of the section's own
text covered by at least one proposal's evidence span, and (2) a ratio of qualifiers emitted against
counts of four fixed marker words ("as of", "except", "knowledge", "material") in the source text.
Neither proxy rejects anything or constructs a claim — both only attach a typed `COVERAGE_SUSPECT`
signal when a threshold is crossed, each threshold explicitly calibrated (and the calibration shown
in the header) against two real F28 recordings, one that should fire and one that should not.

**Capability nobody is using.** None — confirmed wired into `native-extraction-run.js`'s receipt for
every resolved section (both dispatched and undispatched, with empty inputs for the latter).

**Defects and traps.** None found; the threshold-calibration reasoning in the header is unusually
well-grounded (named real data points, not round numbers picked by feel).

**Plan.** No gap found.

**Header accuracy.** Accurate; no edit made.

---

## lib/canonical-v2/native-producer/limb-components.js — HEADER FIXED (stale "not wired in" claim)

**What it does.** Mints a two-node LIMB IDENTITY tree per provision instance from compiled
candidates: PATH nodes (one per distinct `limb_path`, structural, span always null) and ASSERTION
nodes (one per compiled `LIMB_ASSERTION` proposal under that path, each with its own real,
byte-verified span). Exists because one limb marker (e.g. bare `"(ii)"`) can legitimately carry
several legally distinct assertions in real drafting, and collapsing them under one span would
conflate separate representations under one claim subject. Also resolves where a qualifier attaches
in that tree (`resolveQualifierAttachment`, ambiguous only when more than one ASSERTION child
exists) and walks governed scope down from a resolved attachment (`traverseGovernedScope`),
respecting a suspension rule for unruled ambiguous attachments.

**Header fixed — this is the exact defect class the task exists to catch.** The header's own
"STANDALONE AND PURE" paragraph read: *"It performs no I/O, no model calls, and does not itself get
wired into candidate-resolution.js -- that integration is a later task."* I grepped and confirmed
this is false today: `candidate-resolution.js` requires this module (line ~251) and calls
`mintLimbComponentTree` (line ~5279) and this module's own `resolveQualifierAttachment` (line
~5291); `semantic-safety-preflight.js` (outside my batch) also imports it directly. The "later task"
already landed and the header never caught up — a smaller-scale instance of exactly the same
"header describes a past state as if it were current" failure the coordinator made about the section
classifier. Corrected in place; kept the reasoning, updated the fact, and pointed future readers at
the actual call sites rather than a new sentence that will just as surely go stale.

**Trap I found and flagged in the header: a real name collision.** This module's own
`resolveQualifierAttachment(tree, {governs_path, review_outcome})` — which tree node a qualifier
attaches to — shares its exact exported name with `qualifier-attachment.js`'s
`resolveQualifierAttachment({position, governs_path, quote_text, ...})` — what scope a qualifier's
text implies — a completely different function with a completely different signature.
`anthropic-provider.js` imports the latter; `candidate-resolution.js` and
`semantic-safety-preflight.js` import the former. No file currently imports both (checked by grep),
so there is no live bug today, but a bare `resolveQualifierAttachment` reference anywhere in this
codebase (a future import, a grep result, a code review comment) is genuinely ambiguous without
checking the `require()` path. Added a warning to the header; consider renaming one of the two if
either module is touched again.

**Capability nobody is using.** None remaining, now that the header is corrected — both exported
capabilities are live.

**Defects and traps.** The name collision above. Otherwise none found; the deterministic tie-break
discipline (span position, then a normalised-quote hash, never input array order) is careful and
explicitly tied to a named prior audit finding (round-2 audit finding 3).

**Plan.** None beyond noting the header was stale in a way that, had this module been the subject of
a status question the way the classifier was, could have produced the same wrong answer.

---

## lib/canonical-v2/native-producer/qualifier-attachment.js

**What it does.** Turns a qualifier's model-reported `position` (CHAPEAU/ITEM/TRAILING) plus its own
byte-verified quote text into a `scope_reading` (ALL_ITEMS/THIS_ITEM_ONLY/AMBIGUOUS) — deliberately
never by asking the model to self-report scope (there is no such field in the response contract) and
never by re-asking it. CHAPEAU and ITEM are unambiguous by construction; TRAILING runs a lexical
marker scan against two fixed phrase families (SERIES markers like "in each case" imply the whole
list; SINGLE-CLAUSE markers like "solely with respect to" imply the last item only) — both present
is AMBIGUOUS (contradictory drafting, a real review item); neither present is also AMBIGUOUS (silent
trailing text — the model must never be trusted to pick). For the ambiguous case,
`buildAmbiguousReadings` pre-computes what each of the two live readings would concretely mean
(SERIES vs. LAST_ANTECEDENT sibling limb paths) so a human reviewer sees the consequence, not just
the label.

**Capability nobody is using.** None — confirmed live, imported by `anthropic-provider.js` and
exercised in its qualifier-shaping path.

**Defects and traps.** Shares its exported function name with an unrelated function in
`limb-components.js` — see that module's entry above for the full trap description; flagged there
rather than duplicated here since that is where I added the header warning.

**Plan.** No gap found.

**Header accuracy.** Accurate; no edit made.

---

## lib/canonical-v2/native-producer/limb-enumeration-scan.js

**What it does.** Scans a governed section's raw text for enumeration marker tokens
((a)-(z)/(A)-(Z)/roman numerals) and compares the set found against the limb paths a run actually
proposed, producing typed `MARKER_WITHOUT_LIMB` / `LIMB_WITHOUT_MARKER` disagreements — a cheap
recall check, corroboration only, never identity construction (that is `limb-components.js`'s job).
Most of the file is disambiguation machinery for markers that are structurally ambiguous
(a lowercase "(c)" could be alpha-item-3 or roman-numeral-100, etc.) plus classification of
markers that look like limb enumeration but are not: a section's own paragraph label repeated as
its citation's trailing component, or a marker sitting inside an in-prose cross-reference to
another section. Both classifications are reported, never silently dropped, and excluded from the
comparison rather than miscounted as agreement or disagreement.

**Capability nobody is using.** None — confirmed wired into `native-extraction-run.js`'s receipt
(`limb_enumeration_scan`, one entry per resolved section, computed inside a never-fails-the-run
wrapper).

**Defects and traps.** None found that survive the module's own discipline. Notably well-hardened:
three separate real triage fixes are named and dated in the header (Modiv 21/21 false positives from
not recognising paragraph-opening markers; a Fable review catching a case where a genuine limb-list
gap would have been swallowed into "not a limb list at all"; a value-aware refinement so only a lone
"(i)" keeps a lopsided default, every other ambiguous lone letter is typed ambiguous rather than
guessed). The lookbehind windows (`CROSS_REFERENCE_LOOKBEHIND_CHARS = 40`, `LINE_START_LOOKBEHIND_CHARS
= 8`) are fixed character budgets rather than derived from the pattern being searched for — same
minor, unconfirmed-in-practice class of gap as `citation-constructibility.js`'s own 15-character
lookbehind, noted there.

**Plan.** No gap found.

**Header accuracy.** Accurate; no edit made.

---

## lib/canonical-v2/native-producer/review-queue-artifact.js

**What it does.** The committed writer for the `RESOLUTION_REVIEW_QUEUE/V1` artifact — a
deliberately dumb, pure pass-through of `resolveCandidates(...)`'s own `review_queue` array into a
content-addressed, disk-writable JSON shape, plus an additive `counts` block. Exists because a named
prior gap (F28 third-live-run finding M4) had three scripts reading a queue artifact that no run
driver actually committed to disk. Explicitly reshapes nothing and re-derives nothing the resolver
did not already compute.

**Capability nobody is using.** None — confirmed wired into four live-run driver scripts.

**Defects and traps.** None found. The `counts` field's strictly-additive, omitted-when-absent
convention (never present-as-zero) is a careful, explicit guard against silently changing every
existing artifact's content-addressed id when a new instrumentation field is introduced — worth
noting as a pattern this codebase applies consistently (the same convention is named as shared with
`resolution_receipt.lexical_disagreement_counts`).

**Plan.** No gap found — this module is itself the closure of a gap a prior audit already found and
recorded.

**Header accuracy.** Accurate; no edit made.

---

## lib/canonical-v2/native-producer/qualifier-kind-lexicon.js

**What it does.** Deterministic qualifier-kind classifier (KNOWLEDGE/TEMPORAL/ACCURACY/THRESHOLD,
extended under P2 to six kinds with DISCLOSURE_SCHEDULE_CARVEOUT/PERFORMANCE_ASSUMPTION), built
because the model's own self-reported `kind` field was observed unstable across runs on identical
text. Recomputes kind from the quote's text alone via a real parenthetical-depth-aware
clause-binding algorithm (an "except"/"other than"/"excluding" connective auto-binds a clause; a
comma at the connective's own depth only closes the clause if what follows contains another marker
or connective; a marker with no preceding host at its depth routes to review rather than being
silently attached to the wrong span), then decides per-quote whether the result is a clean
CLASSIFIED, a deterministic SPLIT into multiple kinds, a REVIEW (only when doubt touches an
identity-bearing kind — ACCURACY or DISCLOSURE_SCHEDULE_CARVEOUT), or OPEN_WORLD (doubt confined to
non-identity-bearing kinds). The model's `kind` hint is used only as, at most, a routing signal —
never trusted as ground truth, and a missing hint is defined as abstention, never disagreement.

**Capability nobody is using.** None — confirmed heavily wired into `candidate-resolution.js` (5+
call sites, including the injected-classifier pattern `ruling-corpus.js` documents from its own
side).

**Defects and traps.** This is the densest, most legal-judgment-weighted module in my batch (on a
par with `lib/rubric.js`/`lib/taxonomy.js`-tier work per this project's own routing guidance) and I
read it for structure and cross-checked its wiring, but a hand-trace cannot fully verify an
algorithm this intricate the way it can for the smaller parse modules — that assurance has to come
from the test suite (run at the end of this task) and, for anything touching the
`ACCURACY_CODE_WHITELIST` specifically, from the Fable/Ben governance review the header itself says
every whitelist edit requires. No logic error found on read. Worth flagging as a general pattern,
not specific to this file: the whitelist's exact-phrase matching (`deriveAccuracyCode`) means a
materiality-standard phrase that is legally equivalent but not byte-identical to a whitelisted entry
resolves to `code: null` and, if the kind is ACCURACY, routes to review rather than auto-classifying
— correct per the design (never guess a code), but worth knowing the whitelist is exact-string, not
semantic, matching.

**Plan.** No gap found.

**Header accuracy.** Accurate; no edit made.

---

## The producer-prompt cluster (5 modules): capitalisation-producer-prompt.js, mae-definition-producer-prompt.js, no-shop-producer-prompt.js, termination-fee-producer-prompt.js, termination-producer-prompt.js

Grouped because they share one exact contract and a consistent internal shape: a frozen
`CONTROLLED_VOCABULARIES` object, a `RESPONSE_SHAPE` JSON-schema-as-prose template, an `INSTRUCTIONS`
block written as legal-drafting guidance to the model, and a single `build<Family>ProducerPrompt`
function that concatenates them with the source text into one `{role: 'user'}` message — never reads
files, never calls a model, never decides anything about the result. All five are the first five
families registered in `producer-prompt-registry.js` (confirmed against `REGISTRY`) and all five have
a matching live shaper in `anthropic-provider.js`'s `FAMILY_ADAPTERS` (confirmed earlier).

**What each governs.** `capitalisation-producer-prompt.js` (PROMPT_VERSION 5, the oldest and most
mature — five real revisions, each tied by the header to a specific, named live-run defect and its
fix) governs the capitalisation representation and its bring-down: qualifier position/scope
separation, per-limb decomposition, share-count typing. `mae-definition-producer-prompt.js`
(v2) governs MAE/MAC definitions: prongs, carve-outs, limb-local vs. trailing disproportionality
carvebacks, with an explicit "mention vs. definition" rule keeping a cross-reference to the term out
of the typed path. `no-shop-producer-prompt.js` (v3) governs no-solicitation covenants and their
fiduciary exceptions, with a legally-loaded instruction distinguishing NOTICE/INITIAL_MATCH/
SUBSEQUENT_MATCH periods by function rather than by whatever the agreement's own defined-term label
happens to say. `termination-fee-producer-prompt.js` (v3) governs fee amount/trigger/tail — its
header is the clearest worked example in my whole batch of a prompt evolving against real production
failures (v2 fixed a term-severance defect; v3's own header states plainly that v2's fix, verified
only against a synthetic replay and never a live model call, "is a strict improvement... but zero
usable structured data" for one real Modiv shape, and introduces `limb_amount_quote` to fix it).
`termination-producer-prompt.js` (v2) governs termination-rights grants, outside dates and cure
periods, splitting each into one legal fact per assertion so the parsers' own exactly-one-candidate
rules are satisfiable by construction.

**Capability nobody is using.** None — all five wired end-to-end (registry, prompt, live shaper).

**Defects and traps.** None found in the prompt text or builder functions themselves — the actual
legal-judgment risk in this cluster lives in the INSTRUCTIONS prose, and validating that prose
against real drafting is exactly the "Fable/Opus, spec-on-Fable, produce-on-cheap, review-on-Fable"
tier of work this project's own routing guidance reserves for prompt engineering; a single read
pass can confirm internal consistency (which I did — vocabularies match the resolver's registered
codes, response-shape fields match what `anthropic-provider.js`'s shapers expect) but cannot itself
validate legal correctness against novel drafting. One structural observation, not a defect: each
prompt hand-carries its own copy of certain controlled vocabularies as literal strings rather than
importing from `contract-bundle.js`, and each header explains why (no-shop and MAE-definition import
directly where a bundle export already exists; capitalisation/termination-fee/termination hand-carry
because no bundle export exists for that specific vocabulary) — worth knowing this is a deliberate,
mixed convention rather than an inconsistency, should a future family's vocabulary need to move from
one style to the other.

**Plan.** No gap found.

**Header accuracy.** All five accurate; no edits made. `termination-fee-producer-prompt.js`'s header
states plainly that it does not solve the grounds-to-figure mapping problem ("scoped out, not solved
here") — I confirmed this remains true of the prompt module specifically (the mapping is solved one
layer downstream, in `termination-fee-parse.js`'s `selectFeeAmountGroundsCondition`, read separately
in this same batch) so the header's narrower claim about itself still holds; not a contradiction.

---

## lib/canonical-v2/native-producer/native-extraction-run-citation-followup.js

**What it does.** Handles the case where a termination-fee trigger candidate names its ground only
by a bare cross-reference ("by Parent pursuant to Section 7.1(d)(ii)") whose actual descriptive
words live in a section outside the original call's governed scope. Runs the caller's own requested
sections exactly as an ordinary `runNativeExtraction` call (pass A); if pass A's compiled candidates
contain a bare-citation-shaped, null-`trigger_code` fee-trigger candidate, dispatches exactly one
more, fully independent `runNativeExtraction` call (pass B) for the cited section(s), then merges
the two run receipts into one, content-addressed over the merged body. The hop limit is exactly one,
enforced structurally (there is no loop or recursion, not a counter that could be miscoded) — a
citation found inside a pass-B section's own text is reported (`CITATION_CHAIN_NOT_FOLLOWED`,
carrying `chains_to` for visibility) but never chased. Confirmed wired into
`scripts/canonical-v2-live-extraction-run.mjs`, the actual live-run driver PLAN.md itself names as
"the runner that dispatches a family at a deal."

**Capability nobody is using.** None — genuinely live.

**Defects and traps.** None found. Worth noting for anyone extending this: the follow-up dispatch
uses `section_family_assignments` (the manual/pre-resolved path in `native-extraction-run.js`),
hardcoded to the single family `TERMINATION_FEE` — a deliberately narrow, v1-scoped reuse (the
header is explicit: "the ONLY family this module knows how to follow up for v1"), not an instance of
the broader manual-vs-automatic classification question in the headline finding above. Every
declined case is a typed, distinct residual reason
(`CITATION_ALREADY_DISPATCHED`/`CITATION_REFERENCE_UNRESOLVED`/`CITATION_REFERENCE_AMBIGUOUS`/
`CITATION_TARGET_NO_TRIGGER_CANDIDATE`/`CITATION_CHAIN_NOT_FOLLOWED`) — no silent "nothing happened"
case that is actually "something was found and declined."

**Plan.** No gap found.

**Header accuracy.** Accurate; no edit made.

---

## lib/canonical-v2/native-producer/run-comparator.js — capability built as a "standing instrument" but only ever invoked by one historical script

**What it does.** Diffs two independent runs of the SAME governed section (limbs matched on exact
`limb_path` equality plus non-contradicting spans; qualifiers matched on normalised-quote equality
alone) and reports what each run found that the other did not. Built because every existing gate in
this pipeline is precision-only (it can reject a bad proposal) and nothing measured recall — two real
F28 recordings of the identical section disagreed by roughly ten qualifiers while both passed every
existing gate at zero residuals, silently. Deliberately decoupled from `native-extraction-run.js`'s
and `candidate-resolution.js`'s actual shapes: it consumes a small, generic `RUN_SECTION_VIEW/V1`
that "a later integration is responsible for projecting."

**Capability nobody is [fully] using.** The header's own framing calls this "the standing instrument
that would have caught that silently" — language that implies routine, ongoing use. I grepped for
every caller and found exactly one: `scripts/canonical-v2-f28-third-live-extraction-run.mjs`, a
one-off script tied to one specific historical live run, plus its own test file. It is not called
from `scripts/canonical-v2-live-extraction-run.mjs` (the actual current live-run driver PLAN.md
names), not from `candidate-resolution.js`, and not from any recurring QA/CI script I could find. The
"later integration is responsible for projecting a RUN_SECTION_VIEW out of whichever receipt shape is
current" the header describes as future work still reads as not done — a real, tested, working
cross-run recall check that is not standing guard over anything today, built for exactly one
already-completed investigation and, as far as I can verify, not reused since. Smaller in scope than
the two headline findings (this is a diagnostic instrument, not a classification/evidence-integrity
gap), but the same shape: a capability described as ongoing infrastructure that is actually dormant
outside the one case that motivated it.

**Defects and traps.** None found in the comparison logic itself; the matching rules are careful
(path equality is mandatory even when spans overlap, specifically to avoid the exact defect that
motivated this module: two limbs reusing the same flat label under unrelated parents).

**Plan.** Worth a line in `docs/core/PLAN.md` if cross-run recall checking is meant to be routine:
either wire `compareRuns` into the main live-run driver for every multi-run deal, or make explicit in
the plan that it remains a one-off diagnostic tool, not a standing gate.

**Header accuracy.** The "standing instrument" framing is aspirational relative to current wiring,
not a factual claim about a specific mechanism (unlike limb-components.js's now-fixed false claim
above), so I did not edit it — it is describing what the module is FOR, correctly, not asserting a
specific caller exists. Flagging the gap between intent and current wiring here instead.

---

## lib/canonical-v2/native-producer/v1v2-comparator.js

**What it does.** Auto-pass condition 1 of Ben's M3 review protocol: a pure, deterministic
cross-check between a v1 (old parser) provision snapshot and v2's `resolveCandidates()` output for
the same deal. Tier 1 (presence/identity) maps every v1 `(provision_type, provision_subtype)` pair to
a v2 `concept_key` through an explicit, versioned, no-fuzzy-matching table (41 REPRESENTATION
subtypes grounded against a real TopBuild snapshot, plus 7 subtypes Ben personally ratified
2026-08-02, plus 3 deliberately left `V1_CARD_UNMAPPED` pending a v1 reclassification slice) and
reports presence agreement, section mismatch, or various "one side has it, the other does not"
outcomes. Tier 2 (value agreement) only runs where a `VALUE_MAPPING_TABLE` entry exists for the same
concept on both sides — today that table holds exactly one synthetic-fixture-only entry, because (the
header states plainly) no real v2-reviewed TERMF/NOSOL slice exists yet and the real REPRESENTATION
snapshot this module is grounded against carries no per-claim values at all. A `quote_probe` signal
exists but is explicitly advisory-only, never read by any outcome-deciding branch.

**Capability nobody is using.** None in the sense of dead code — confirmed genuinely wired, but via
dependency injection rather than a direct import: `candidate-resolution.js`'s own header explicitly
states "This module NEVER imports that one" and instead accepts an OPTIONAL, STRICTLY ADDITIVE
pre-computed comparison receipt as an injected argument — the same architectural pattern used
throughout this codebase (provider injection, ruling-corpus classifier injection). `scripts/export-
v1-provision-snapshot.mjs` and `scripts/nets-eligibility-report.mjs` both use it directly. Correctly
wired, not a gap.

**Defects and traps.** None found. Worth flagging as a fact rather than a defect: Tier 2 (value-level
corroboration) is real, tested machinery that currently has nothing real to corroborate — every
production run today can only ever exercise Tier 1. This is disclosed candidly in the header, not
hidden, so it is not the kind of finding the classifier story is about, but it is worth knowing that
"auto-pass condition 1" is, in practice today, a presence/identity check only.

**Plan.** No gap found — the header's own governance note (a new `VALUE_MAPPING_TABLE` entry is a
Fable+Ben table edit, not a code change) already describes the path to closing the Tier-2 gap.

**Header accuracy.** Accurate; no edit made.

---

## lib/canonical-v2/native-producer/native-write-set-adapter.js

**What it does.** The single boundary where a run receipt's candidates leave section-local
coordinates and enter the canonical write path in document-absolute coordinates. Because
`runNativeExtraction` only ever shows a producer one section's own text, every compiled candidate's
evidence offsets are section-local; this module computes `section.start + local_offset` exactly
once (so no downstream stage can mistake a section-local offset for a document-absolute one) and,
critically, re-derives every identity hashed on top of those offsets (excerpt id, evidence-edge id,
revision id) rather than just shifting numbers — because those ids are content-addressed FROM the
offsets, silently shifting the numbers without re-hashing would leave a row's own stated identity
pointing at bytes that no longer exist under that id. Also lazily mints `REPRESENTATION_LIMB`
component rows for assertion-node claim subjects when a resolution context is supplied, and re-keys
the affected claim's `subject_occurrence_id`/`claim_occurrence_id` onto the new component id in the
same pass. Confirmed genuinely wired into `candidate-resolution.js` and six live-run driver scripts
including the main `scripts/canonical-v2-live-extraction-run.mjs`.

**Capability nobody is using.** None — fully wired.

**Defects and traps.** The header explicitly discloses a deliberate duplication: this module
reimplements `claims-relationships.js`'s revision-id hash formula against the public `contentId`
primitive rather than importing it, because the private helpers that compute it are not exported and
that file is "frozen/off-limits for this change." The header itself names this as "three independent
call sites computing the identical hash" (this module, `claims-relationships.js`,
`validate-write-set.js`'s own `expectedObjectId`) — a correctness-by-convention arrangement rather
than a correctness-by-construction one. I did not find, and did not have budget to hunt for, a
cross-file "lockstep" test of the kind this codebase uses elsewhere (e.g. `ruling-corpus.js`
QUALIFIER_KINDS vs. `qualifier-kind-lexicon.js`) to pin all three formulas as identical; worth
confirming one exists, since a future edit to any one of the three that is not mirrored in the other
two would silently produce mismatched revision ids rather than an error.

**Plan.** No gap found in the module itself; the three-way hash-formula duplication above is worth a
line in whichever backlog tracks technical debt, if a lockstep test does not already exist.

**Header accuracy.** Accurate and exceptionally precise about what it does and does not solve
(explicitly lists `subject_occurrence_id`/`source_occurrence_id` construction as out of scope,
naming exactly what a caller must supply for those references to resolve). No edit made.

---

## lib/canonical-v2/reviewed-slice-harness.js — HEADER CLARIFIED; capability built, motivating consumers never migrated

**What it does.** A pure, generic construction harness (`buildReviewedSlice(input)`) for hand-built
"reviewed deal-slice" regression oracles — plain-data-in, fully-assembled canonical objects out
(sources, spans, excerpts, provisions, components, claims, relationships, results, serving rows),
covering the identity-derivation and assembly mechanics (`contentId`, `source-structure.js`,
`claims-relationships.js`, `serving-projection.js`, `shared-serving-row.js`) that a hand-rolled
oracle module would otherwise have to reimplement itself. Validates every input shape with an
exact-keys check (extra or missing keys throw) and never defaults, coerces, or guesses — evidence
location itself is explicitly out of scope; callers supply already-resolved absolute byte offsets.
Handles genuine disagreement between existing oracles about payload shape (semantic-closure key
style, canonical-write-set source-bag shape, composition-scope-closure shape, what counts as
governed evidence) via explicit caller-supplied switches rather than guessing.

**Capability nobody is using / header clarified.** The header names three specific modules as the
motivating case — `reviewed-termination-fee-slice.js`, `reviewed-qxo-no-shop-slice.js`,
`reviewed-no-shop-slice.js` — and describes this harness as performing "the REPEATED construction
mechanics they each hand-roll." I checked directly: none of the three requires this harness, or
mentions it anywhere, even in a comment; all three still hand-roll their own construction exactly as
the header implicitly assumes they no longer do. The only real caller anywhere in the repo is a
single new fixture, `__fixtures__/canonical-v2/qxo-termination-fee-row.js`, plus the harness's own
test file. This is a complete, tested, generic tool built explicitly to retire duplicated
hand-rolled mechanics across (at least) three existing files, and none of those three files has been
migrated onto it. Added an "ADOPTION STATE, CHECKED DIRECTLY" paragraph to the header stating this
plainly, so a future reader does not read the motivating paragraph as a completed migration.

**Defects and traps.** None found in the harness logic itself — the exact-keys discipline is applied
consistently throughout.

**Plan.** If the point of building this harness was to stop three modules from independently
hand-rolling the same mechanics (and risking exactly the kind of formula drift
`native-write-set-adapter.js`'s entry above flags as a live risk elsewhere in this codebase), the
migration itself is unstarted, real work — worth a line in `docs/core/PLAN.md` if it is still wanted,
or an explicit note that the harness is now scoped to new fixtures only, if the migration was
deliberately abandoned.

**Header accuracy.** Edited in place — added the adoption-state paragraph above; left the original
rationale untouched since it correctly explains why the harness exists and what it mechanises, it
just does not (and did not, even when accurate) say whether the three named modules use it.

---

## lib/canonical-v2/native-producer/lexical-disagreement-net.js

**What it does.** Auto-pass condition 2 of Ben's M3 protocol — see the THIRD HEADLINE FINDING above
for the wiring status. Pure, deterministic: recomputes and verifies the governed section's own
`text_sha256` (fail-closed on mismatch, never trusts the given text as authoritative), then for
every family in the union of (lexicon-covered families, families the run's own candidates carry)
scans a frozen, versioned, 16-revision lexicon of literal phrases/acronyms/bounded-regex patterns
against the section text and classifies each hit MATCHED (byte-verified round-trip reproduction AND
overlaps a same-family candidate's own evidence span) or UNMATCHED (a disagreement — the lexicon
found textual evidence for the family that no candidate accounts for). A family entirely absent from
the lexicon is `LEXICON_FAMILY_UNCOVERED` by construction — "a missing row can never read as clean."
The net only VETOES (blocks an ABSENT conclusion); it never constructs a positive claim of its own
from an unmatched hit — extraction semantics rule 2, "lexical disagreement vetoes negatives, never
creates positives."

**Capability nobody is [fully] using — see the THIRD HEADLINE FINDING.** Confirmed the real net-runner
(`buildLexicalDisagreementReceipt`) has exactly one production caller,
`scripts/nets-eligibility-report.mjs`, and the main live-extraction driver never supplies its output
to `candidate-resolution.js`.

**Defects and traps.** None found in the matching/offset-mapping logic itself, which is unusually
careful: UTF-8 continuation-byte snapping for excerpt boundaries, a round-trip predicate
(`normaliseForMatching(utf8Slice(...)) === matchedNormalisedText`) before any hit counts as MATCHED
rather than trusting an offset arithmetic chain, cross-family evidence explicitly excluded from
matching (a capitalisation candidate's evidence can never silently satisfy a no-shop family's
lexical hit). The lexicon itself carries several named, deliberate, "priced" blind spots (bare
"option(s)" excluded because it floods with false positives on "option to terminate";
"material"/"adverse"/"effect"/"GAAP" excluded from the MAE family for the same reason) — each
justified in the comments as a considered trade-off, not an oversight, consistent with the
"deletion asymmetry" principle the header states explicitly (removing a pattern narrows the veto and
widens auto-pass, so every removal needs a recorded rationale; additions are cheap and encouraged).

**Plan.** Covered by the third headline finding.

**Header accuracy.** Accurate; no edit made.

---

## lib/canonical-advisors.js

**What it does.** Read-time canonicalization of law-firm and lawyer names captured from notices
provisions: `canonicalFirm` maps ~40 known firms (regex alias table) to a market-colloquial short
name and falls back to a cleaned raw string for unmatched firms; `canonicalLawyer`/
`canonicalLawyerKey` normalise display form and produce a dedupe key (first|last, ignoring middle
initials/suffixes). `getDisplayAdvisors` is the actual read-time entry point the UI calls, with a
three-tier fallback across `metadata.advisors_v2` → `metadata.deal_facts.advisors` → legacy
`metadata.advisors`.

**Capability nobody is using.** None — confirmed actively used (components, `lib/home-data.js`,
`lib/query/`, two backfill scripts).

**Defects and traps.** `canonicalLawyerKey`'s dedupe-by-`first|last` is a real (if narrow) collision
risk: two different lawyers who share a first and last name at the same firm collapse to one entry,
and `dedupeLawyers` keeps whichever canonical form is textually longest — not whichever is most
recent or most complete by any authoritative signal. Low-probability, not flagged anywhere as a
known limitation.

**Plan.** No gap found.

**Header accuracy.** Accurate; no edit made.

---

## lib/broad-corpus/contained-routes/from-url.js

**What it does.** A fully-repaired, tested implementation of the ingest-from-URL route, restored
from git history with the July-security-review SSRF finding fixed (host allowlist + redirect
revalidation, actually implemented in the sibling `./from-url-fetch.js`, not this file). Verified
this is genuinely not live: `pages/api/ingest/from-url.js` still resolves to
`createBroadCorpusContainedHandler('POST')`, an unconditional 503, exactly as the header says.

**Capability nobody is using — real, but already self-disclosed.** This is a complete, reviewable,
presumably-tested SSRF fix sitting unused because ingestion is deliberately off
(`ROADMAP.md`), not because the fix is incomplete. Unlike the classifier story, this module's own
header is upfront about being dormant, and the live route file (`pages/api/ingest/from-url.js`)
cross-references it by name in its own comment — this is a case of the header being *right*, not a
case of undisclosed capability. Flagging per the task brief's instruction to report every working,
bypassed code path regardless of whether it's already known, since "already disclosed in a comment"
is not the same guarantee as "known to whoever is sequencing `docs/core/PLAN.md`."

**Defects and traps.** None found in the logic read. One structural note: this file
`require()`s `scripts/ingest-qa.js` (`evaluateDealMetadataGates`) from inside `lib/` — a
scripts-as-library dependency direction that is unusual but not obviously wrong, and the header
already explains why the file can't be unit-tested standalone under plain `node --test` (transitive
`lib/anthropic.js` → `./model` extensionless import, a Next-bundler-only resolution).

**Plan.** `docs/core/PLAN.md`/`ROADMAP.md` already track "ingestion stays off" as a deliberate
policy choice (per this file's own header) — no gap in the plan's awareness, just worth noting this
specific piece of remediation work is a small, scoped, already-paid-for unit whenever ingestion
does get re-enabled.

**Header accuracy.** Verified against the live route file; accurate. No edit made.

---
