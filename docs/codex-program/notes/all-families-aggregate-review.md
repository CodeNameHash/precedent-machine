# Adversarial review of the all-families fix plan, 2026-08-06

Verdict: implement, with seven named changes. The evidence-reading core is
sound. Every count the reviewer recomputed either matched or erred against the
plan's own favour, both claimed crash reproductions replay exactly, and the two
claims made under coordinator steering, the ones most at risk of motivated
reasoning, survived checking.

What follows is the reviewer's findings, ordered by consequence.

## Disproved: there is no appraisal sectionizer bug

The plan claimed the sectionizer reports section 2.6 at bytes 50293 to 50412
while the real section begins 272 bytes earlier, so the model was shown a
fragment of the following section.

Rebuilt from the pinned HTML, whose hash matches the deal pin exactly, byte
offsets 50293 to 50412 hold precisely `Section 2.6 Dissenters' Rights. No
dissenters' or appraisal rights shall be available with respect to the
Mergers.` That is the correct and complete section, 119 bytes. The figure 50021
is the CHARACTER index of the same string. The 272 difference is accumulated
multi-byte characters, curly quotes, earlier in the document.

**This is the third appearance of the same error class in two days.** It
previously produced a retracted headline claim that a section began 1,450 bytes
late, and before that a false report that 1,450 bytes of contract text had been
silently dropped. Each time the shape is identical: a probe uses
`text.indexOf` or `text.slice`, which count UTF-16 code units, and compares the
result against the byte offsets this pipeline actually uses everywhere. The
extraction path slices by bytes. The codebase already carries a helper whose
only purpose is converting between the two.

The real appraisal question is smaller and different. The model was given the
correct section and returned no assertions at all, on a flat rights-denial
clause. "Appraisal rights are not available" appears to have no slot in that
family's schema. That is a vocabulary design question, not a boundary fix, and
the blast-radius investigation the plan proposed should be deleted rather than
scoped.

## Corrected counts and diagnoses

**The reference-not-in-quote fix covers four candidates, not five.** The single
`CONTROL_PARTY_REF_NOT_IN_QUOTE` item carries `control_party: null`: the model
proposed no reference at all, on a passive clause. The resolver conflates
"absent" with "present but not in the quote". An adjacency check has nothing to
verify here, so this one needs a nullability decision instead. The four
`MEETING_REF` items are genuine and are exactly the pre-fix MAE shape: all four
references appear verbatim in the section text, outside deliberately narrowed
quotes. Model right, checker wrong.

**The plan quotes a chapeau that does not exist, and the real drafting is why
the largest fix is hard.** Modiv's termination chapeau names no party at all.
The party grants live in the limb heads: "by either the Company, on the one
hand, or Parent, on the other hand", "by written notice from the Company to
Parent", "by written notice from Parent to the Company". The reviewer replayed
the existing rescue mechanism against all twelve recorded candidates: neither
of its patterns matches anywhere in the section, one wanting active voice that
is absent, the other requiring the party adjacent to "by" within 400 characters
of the chapeau when the limbs sit thousands of characters in.

So the plan's decision to defer is moot, the diagnosis took under an hour. But
its caution was accidentally right for a reason it did not know: **every limb
head names both parties**, so a naive substring-adjacency port would corroborate
the wrong party on half of them. The fix must anchor on the candidate's own limb
citation, which the sectionizer already resolves as a node, and parse the from
and to directionality.

**Capitalisation's first call succeeded.** It completed in about 525 seconds
with 58,867 output tokens and its full response is on disk. The timeout killed
the second call. Half that family's extraction is already salvageable without
paying for a re-run.

**The headline totals disagree with the shipped baseline.** The plan says
111 resolved, 206 queued. The baseline, regenerated minutes later to judge
completeness on the last pipeline stage rather than the first, says 108 and
203. Both conventions are defensible; shipping both as "the" baseline will
confuse whoever implements from them.

## Confirmed, having tried to break them

The consideration mapping holds and is understated: the true split is 18 of 20
mappable, not 17, and the plan missed its own strongest evidence, an existing
V1 provision type for exchange funds and payment procedures with four aliases.

One correction to that fix: mapping the fractional-share items onto V1's
proration field is a false friend. That field describes election-deal
proration, with an election type and deadline. All three Modiv items are
fractional-share cash-out mechanics, and the word "fractional" appears nowhere
in the V1 rubric. Porting them as election proration would encode a wrong legal
concept.

The specific-performance finding is exact, and carries an internal
inconsistency that makes the fix cleaner: a sibling check in the same file
already accepts "monetary", while the quote-level check accepts only "money".

The advice not to re-chase the MAE candidates is right and better supported
than the plan says: a committed test already pins seventeen of them resolving.

## The missing piece

The plan re-classified open world correctly and then wrote fix items only for
the three families it examined. Across all runs, 113 of 193 open-world entries
are genuine missing vocabulary and 80 are governed but rejected. The fix list
covers at most 74. **The remaining 119 have no owner**, including five families
whose entire output is open world and which appear nowhere in the plan: key
defined terms, general covenants, tax matters, employee matters and dividends.

Antitrust's eleven are a third mechanism the plan never names: a canonical
value outside its enum, which is neither missing vocabulary nor a narrow
corroboration check.

The concentration on tidier resolver failures is real, and one added work item
closes it.

## The seven changes required before commissioning work

1. Rewrite the appraisal item: no sectionizer bug, it is a vocabulary question,
   and delete the blast-radius investigation.
2. Reorder so the two fixes already sitting in the working tree come first, as a
   single review and commit step. Both replay clean.
3. Upgrade the terminating-party item from "investigate, then maybe fix" to a
   specified fix carrying the diagnosis above, including the requirement to
   handle both parties appearing in every limb head.
4. Amend the consideration item to anchor on the existing exchange-fund
   provision type, and do not port the fractional-share items as election
   proration.
5. Correct the reference-not-in-quote item to four candidates and route the
   null one to a schema decision.
6. Add the open-world sweep for the 119 unowned candidates, starting with the
   five families whose entire yield is open world.
7. Reconcile the two sets of headline totals, and record that capitalisation's
   first section is salvageable.
