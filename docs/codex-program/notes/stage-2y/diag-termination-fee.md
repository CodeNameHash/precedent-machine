# TERMINATION_FEE diagnosis — FEE_SIDE_UNCORROBORATED (five cards)

Status: DONE. Branch: origin/cursor/step-2x-free-phase-b641 (7535782a).
Cards source: docs/codex-program/notes/stage-2y/flagged-cards.json (#354, #357, #374, #377, #386).

## Working notes (raw, will be cleaned into final report)

### Code paths

- `lib/canonical-v2/native-producer/candidate-resolution.js`
  `handleFeeTriggerCandidate` (starts L7995). FEE_SIDE_UNCORROBORATED fires
  at L8072-8082 when `corroboratedSides.length === 0 ||
  !corroboratedSides.includes(feeSide)`.
  `corroboratedSides` is built (L8026-8059) from, in order:
    1. `feeSideCorroboratedSides(claim.raw_value)` (L2363) -- regexes in
       `FEE_SIDE_CORROBORATION_TABLE` (L2334) run over the CLAIM'S OWN
       QUOTE ONLY.
    2. `feeSideFromFullPaymentContext` (L7641) -- ONE hardcoded literal
       Modiv-shaped wire-transfer sentence
       (`FEE_SIDE_FULL_PAYMENT_CONTEXT_PATTERNS`, L2350) searched in the
       candidate's OWN section.
    3. `feeSideFromSectionFamilyPaymentContext` (L7743) -- same hardcoded
       literal sentence searched across sibling sections in the same
       `section_family`.
  None of the three ever reads the candidate's own list-item chapeau
  (the "In the event that: (i)... (ii)... (iii)... then the Company shall
  pay..." sentence that actually states the fee side for a limb).

- `lib/canonical-v2/native-producer/anthropic-provider.js`
  `shapeFeeTriggerAssertion` (L1829): `raw_value: assertion.quote` --
  copied verbatim from the model's own `assertion.quote`, byte-verified
  against source, NEVER truncated or widened by this shaping stage. So
  whatever span is `claim.raw_value` in the resolver is exactly what the
  model returned as its `quote` field. No resolver-side truncation
  anywhere in this path.

- `lib/canonical-v2/native-producer/termination-fee-producer-prompt.js`
  `INSTRUCTIONS` (`TRIGGER CODE` paragraph): "...prefer to quote the
  NARROWEST contiguous sub-span that names only the single trigger you are
  coding (e.g. quote just the "(Company Change of Recommendation)"
  parenthetical rather than the whole multi-ground sentence)." This
  example is BYTE-IDENTICAL to card #357's captured quote. This is the
  root cause of Bug 1: the model is doing exactly what the prompt's own
  worked example told it to do.

- `lib/canonical-v2/native-producer/bare-citation-trigger-parser.js`
  `parseBareCitationTriggerQuote`: classifies a quote as a "bare citation"
  (licensing citation-following) only when it contains a `Section X...`
  reference with nothing but connective words left over. A pure
  parenthetical like "(No Solicitation by Parent)" contains NO `Section
  X` token at all, so `cited_references.length === 0` and
  `is_bare_citation` is false -- the citation-following rescue mechanism
  (`resolveCitationFollowupTriggerCode`) can never fire for a Bug-1-shaped
  quote, because the citation itself ("Section 8.1(f)") was already
  dropped before the quote reached this parser. Confirms Bug 1 is a loss
  at the PRODUCER stage, not a resolver gate that could be loosened.

- `findTerminationLimbChapeau` (L1867) + `parseTerminationLimbDirection`
  (L1896) + `findTerminationLimbGrantContext` (L1937) +
  `findTerminationSectionEitherGrantContext` (L1969) ALREADY EXIST and are
  ALREADY WIRED -- but only into `handleTerminationRightCandidate`
  (L10006, calls at L10044 and L10103-10116), the TERMINATION_RIGHT
  ("who may terminate") family, not TERMINATION_FEE ("who pays"). Header
  comment at file top (L53-64, "Step 2X free-phase (DECISIONS.md §15)")
  confirms this mechanism was built specifically to solve "party grant
  lives in the section/limb chapeau, the limb itself carries only
  grounds" -- the exact shape of Bug 2, just for the sibling family. It
  reads the limb's own chapeau structurally (paragraph-initial lettered
  marker, head-bound at `:`/`;`), never guesses, fails closed to null.
  `sourceDerivedCitation(entry)` (L1658), which supplies the citation
  `findTerminationLimbChapeau` needs, is generic -- not family-specific --
  and already available to any candidate entry including fee-trigger
  ones. CONCLUSION: the wiring to reach a limb's chapeau exists and is
  reusable; `handleFeeTriggerCandidate` simply never calls it. This is
  the "same defect shape, different family, mechanism not reused" case
  called out in the brief.

### Source text confirmed for Bug 2 cards

- metsera §8.02(b): "(b) In the event that: (i) the Company terminates
  this Agreement pursuant to Section 8.01(f); (ii) Parent terminates this
  Agreement pursuant to Section 8.01(d); or (iii) ... then the Company
  shall pay (or cause to be paid) to Parent a fee of $190,000,000 (the
  'Company Termination Fee')." Card #374 = limb (ii), #377 = limb (i).
  Fee side (SELLER/Company pays) is stated ONCE, after the list, governs
  all three limbs; the model correctly assigned fee_side=SELLER (per the
  prompt's own "key on who pays, never who terminates" rule) but limb
  (ii)'s own quote text names Parent as the terminating party, with no
  "shall pay" text of its own -- so `feeSideCorroboratedSides` (own quote)
  finds nothing, and `feeSideFromFullPaymentContext`'s hardcoded Modiv
  sentence shape ("...as directed by Parent the Company Termination Fee by
  wire transfer of same day funds...") does not match metsera's actual,
  differently-worded sentence ("...shall pay (or cause to be paid) to
  Parent a fee of $190,000,000 (the 'Company Termination Fee')..." --
  no "as directed by", no "by wire transfer" in the same sentence).

- redhat §5.06(b): "In the event that (i) ... (ii) this Agreement is
  terminated by Parent pursuant to Section 7.01(c) or (iii) this Agreement
  is terminated by the Company pursuant to Section 7.01(f), then, in each
  such case, the Company shall pay (or cause to be paid) to Parent a fee
  equal to $975,000,000 (the 'Termination Fee')..." Card #386 = limb
  (ii). Same shape exactly.

- concho §8.3: (b) "If Parent terminates this Agreement pursuant to
  Section 8.1(c) (Company Change of Recommendation) or Section 8.1(e) (No
  Solicitation by the Company), then the Company shall pay Parent the
  Company Termination Fee..."; (c) "If the Company terminates this
  Agreement pursuant to Section 8.1(d) (Parent Change of Recommendation)
  or Section 8.1(f) (No Solicitation by Parent), then Parent shall pay the
  Company the Parent Termination Fee...". Card #354's quote
  "(No Solicitation by Parent)" is the bare parenthetical name of
  "Section 8.1(f)" inside 8.3(c); card #357's quote
  "(Company Change of Recommendation)" is the bare parenthetical name of
  "Section 8.1(c)" inside 8.3(b). Confirmed: 8.3 here is itself Bug-1
  shaped (whole clause has both the citation AND the "shall pay" fee-side
  language in the SAME sentence as each ground -- unlike metsera/redhat's
  list shape -- so if the model had quoted the full "If Parent terminates
  ... Section 8.1(f) (No Solicitation by Parent), then Parent shall pay
  the Company the Parent Termination Fee" sentence, or even just kept
  "Section 8.1(f)" in the quote, corroboration/citation-following would
  have worked; the failure is purely the prompt's narrowing instruction
  stripping both the citation and the fee-side language down to the bare
  name).

### Corpus counts (latest run per deal, `-2xk-final`/`-2xk-r1-final` for
concho/metsera/redhat/skechers/skywater/topbuild, `-terra-live-v3` for
modiv -- the 7 deals with a TERMINATION_FEE run in evidence/canonical-v2)

NATIVE_TERMINATION_FEE_TRIGGER_CANDIDATE items held with reason
FEE_SIDE_UNCORROBORATED: **32** total.
  - Bug 1 shape (quote is ONLY a parenthetical, `^\(...\)$`): **10** (31%),
    all 10 in concho §8.3.
  - Bug 2 shape (well-formed trigger clause/list-limb quote, no
    parenthetical): **22** (69%), spread across metsera (4), redhat (4),
    skechers (5), skywater (5), topbuild (4). Modiv: 0 (already patched
    via its own scope-correction runs).

By deal: concho 10 (all Bug1), metsera 4 (all Bug2), redhat 4 (all Bug2),
skechers 5 (all Bug2), skywater 5 (all Bug2), topbuild 4 (all Bug2),
modiv 0.

Bug 2 dominates by count (69%) even though the brief's 3 sample cards for
Bug 2 vs 2 for Bug 1 undersold the split slightly; Bug 1 is concentrated
entirely in concho because concho §8.3 packs the citation and the fee-side
verb into the SAME ground-naming sentence, which is exactly the shape the
prompt's own bad example demonstrates narrowing away.

(Sanity check across all 18 run dirs incl. earlier -r1/-rung1/modiv
iterative runs: 72 total, 10 paren-only, 62 other -- inflated by repeated
iterations of the same modiv/concho fixtures during earlier debugging;
not used as the headline number, latest-per-deal above is the current
corpus state.)


### Per-card diagnosis and fix

**#354 concho §8.3(c) -- Bug 1.** Model quoted only the cross-reference's
parenthetical name "(No Solicitation by Parent)" instead of the citation +
name + fee-side sentence. `feeSideCorroboratedSides` finds no pay-verb in
the quote; `parseBareCitationTriggerQuote` sees no `Section X` token
(it was stripped) so citation-following never licenses. FIX: prompt
change. `lib/canonical-v2/native-producer/termination-fee-producer-prompt.js`,
`INSTRUCTIONS` "TRIGGER CODE" paragraph -- replace the
"(Company Change of Recommendation)" worked example with one that keeps
the `Section X.X` citation attached (e.g. "quote 'Section 8.1(c) (Company
Change of Recommendation)', not just the parenthetical alone"), and add an
explicit rule: a trigger quote naming a cross-referenced section must
never drop the `Section X.X` citation token even when narrowing to a
single ground. Requires re-running the producer (digest invalidation) --
not resolver-fixable, since the resolver never sees the dropped citation.

**#357 concho §8.3(b) -- Bug 1.** Same mechanism as #354; quote is
"(Company Change of Recommendation)", the parenthetical name of cited
"Section 8.1(c)". Same fix.

**#374 metsera §8.02(b)(ii) -- Bug 2.** Quote "Parent terminates this
Agreement pursuant to Section 8.01(d)" is a complete, correctly-coded
list limb; its fee side (SELLER/Company pays) lives in the closing "then
... the Company shall pay ... $190,000,000 (the 'Company Termination
Fee')" clause that governs all of limbs (i)-(iii), never repeated
per-limb. None of `feeSideCorroboratedSides` (own quote),
`feeSideFromFullPaymentContext` (wrong hardcoded sentence shape), or
`feeSideFromSectionFamilyPaymentContext` (same wrong hardcoded shape,
other sections) can see it. FIX: resolver-side. In
`lib/canonical-v2/native-producer/candidate-resolution.js`,
`handleFeeTriggerCandidate`, add a fourth fallback tier between step 2
(`feeSideFromFullPaymentContext`) and step 3 (section-family fallback):
call `findTerminationLimbChapeau({ section, admittedSourceContext,
sectionReference: entry.section_reference, citationReference:
sourceDerivedCitation(entry) })` (already exists, already generic, already
imported in this file) to get the limb's structural chapeau text, then run
`FEE_SIDE_CORROBORATION_TABLE[feeSide]` patterns (or a small superset
covering "shall pay ... to Parent/the Company a fee") over
`chapeau.chapeau_text` the same way `feeSideCorroboratedSides` runs them
over the quote today. Free, deterministic, replay-validatable against the
existing recorded evidence -- no prompt/digest change, since `fee_side`
and the source text are already present; only the resolver's search
surface widens.

**#377 metsera §8.02(b)(i) -- Bug 2.** Same mechanism and same fix as
#374; quote is limb (i).

**#386 redhat §5.06(b)(ii) -- Bug 2.** Same mechanism and same fix;
redhat's §5.06(b) has the identical "(i)...(ii)...(iii)... then, in each
such case, the Company shall pay..." shape.

### Connection between the two families

`handleTerminationRightCandidate` (TERMINATION_RIGHT / "who may
terminate") already solves this exact shape -- "party grant lives in the
section/limb chapeau, the limb's own text carries only grounds" -- via
`findTerminationLimbChapeau` + `parseTerminationLimbDirection` +
`findTerminationLimbGrantContext` (candidate-resolution.js L1867-1960,
wired at L10044/L10103). TERMINATION_FEE's `handleFeeTriggerCandidate`
never calls any of them. One mechanism (the chapeau finder) already
exists and is reachable; only the corroboration check that consumes its
output needs to be added for the FEE family. This confirms the brief's
suspicion directly: the wiring is not absent everywhere, it is absent
for exactly one of the two families that need it.

### Uncertain / not settled

- Whether widening `feeSideCorroboratedSides`-style patterns over a
  chapeau text (rather than reusing `parseTerminationLimbDirection`,
  which parses PARTY direction, not PAY direction) could ever produce a
  false corroboration on a chapeau that states BOTH sides' fees (a
  Modiv-shaped two-sided 8.12) — not tested here; the three Bug-2 cards
  examined are all single-payer chapeaux. Whoever implements the fix
  should re-run the existing `AMBIGUOUS_FEE_SIDE` guard (already present,
  L8061-8071) with the chapeau tier added, to confirm two-sided chapeaux
  still route to `AMBIGUOUS_FEE_SIDE` rather than silently picking one.
