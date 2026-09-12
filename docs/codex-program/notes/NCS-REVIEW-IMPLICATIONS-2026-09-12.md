# What Ben's NCS review implies, 2026-09-12

Source: 35 comments, 2 edits and 3 unresolved marks saved on the focused
review page between 19:11 and 20:10 UTC, recorded verbatim in
`BEN-NCS-REVIEW-COMMENTS-2026-09-09.md` section 5. This note is the
assistant's consolidation. Nothing here is a decision; the direction
questions at the end are Ben's.

## The one theme

Almost every comment says the same thing in a different section: the unit
the product tracks is too coarse. A fact that reproduces a whole limb is
correct but useless for comparison. Ben wants each list element, litany,
standard, threshold and qualifier tracked as its own item under the fact,
so that two deals can be compared limb by limb ("the seams of comparison").
He asked for this on the MAE definition prong and carve-outs, the Material
Contracts categories, the no-shop notice contents and clean-up duties, the
regulatory burden list, the fee triggers and tail, the bring-down tiers and
the specific performance clauses. He said explicitly: "make sure your
changes are systematic."

That is a data-model change, not a prompt tweak. Today a fact is one
statement plus a flat bag of named roles. What Ben describes is a fact with
an ordered tree of components: the operative term, then its sub-elements,
each a verbatim quote, with a marker for which pieces are inherited from
the chapeau and which are the fact's own words.

## Systematic defects he confirmed, grouped

1. **Roles are forced, so they are filled with nonsense.** The prompt
   requires every required role to be non-empty and forbids "none". Result:
   "Accordingly" as a timing trigger, "as a prerequisite" as a trigger,
   "under any law" and "in the Court of Chancery" as qualifications, "is of
   a type listed in Section 3.16" as a legal operation, a Delaware forum
   inherited into a clause that has no forum. Ben's question on 8.10 ("is
   the issue that you think you must have a timing element?") is exactly
   right. Fix: timing and qualification roles become optional; add a forum
   role; the prompt allows an empty role.
2. **Actor and object are swapped or invented** (3.16 affiliate contracts:
   actors are the Company and its Subsidiaries on one hand and any Affiliate
   on the other; the object is the material contract).
3. **Subtype names mislabel the provision.** Ben's own names: return or
   destroy requirement; subsequent removal of VDR access; efforts standard
   (not cooperation); restriction on proposing or agreeing to remedies (not
   burden) for the Company-side clause; obligation to litigate; agreement of
   irreparable damage; agreement to equitable relief; delivery of voting and
   support agreements (not vote failure); a date-based bespoke termination
   right (not outside date) for the Novation/Rewind clause; the five-percent
   transferee sentence is a qualifier on the tax opinion condition, not a
   condition; construction rules each need a category so boilerplate can be
   compared later.
4. **Covenants must carry their standard.** For every covenant obligation,
   track whether there is an efforts qualifier (flat obligation versus
   reasonable best efforts) and any materiality qualifier, as first-class
   items.
5. **Bring-downs need the rep list resolved.** Each tier must name the reps
   it covers in words, not section numbers; "remaining" must be computed as
   the complement of the other tiers; the standard ("in all respects", "in
   all material respects", "de minimis", MAE with scrape) is the key item;
   one card dropped "true and correct".
6. **Cross-references must resolve to content.** Closing conditions named
   in termination rights, reps named in bring-downs, the Acceptable
   Confidentiality Agreement definition in 5.2(e)(iii) (which Ben pointed
   out the extraction missed) and the 7.3 fee amount on the trigger card.
7. **Inherited language must be visible and honest.** Show what a fact
   inherits from the chapeau or intro; when a statement fuses the chapeau
   with a limb, present it as a quotation with "[...]" where words were
   skipped rather than as a sentence the agreement never contains. The
   3.16 disclosure list should inherit the "except as set forth in the SEC
   Documents" limitation.
8. **Thresholds and periods are separate items** ($750,000, $250,000 and
   the 6-month look-back), as raised before.
9. **Consent-deal mechanics.** New categories for written consent and
   support agreement delivery; track the percentage or identity of the
   Consenting Stockholders, with a hover on the published page.
10. **Termination breach right.** No separate notice period; the cure
    window is measured from notice and capped at the Outside Date; model
    curability as a branch; link to the 6.1 and 6.2 conditions.
11. **Novation/Rewind right.** Available after 11:59pm Central the day after
    the Rewind closing, only if the Novation is not then effective, and lost
    once the Novation is delivered and effective; not an outside date.

## Two edits need Ben's attention

Both edits (7.1(b)(ii) legal restraint and 7.1(c)(iv) support agreement)
left the statement unchanged and wrote notes in double square brackets
inside role fields. Those items are now in state EDITED and would publish
with the bracketed notes as role text. They should be treated as comments:
either Ben reverts them to pending, or the assistant records them as
comments and Ben confirms the revert. Not done without his say.

## What this means for the plan

The changes above are schema, prompt and data-model changes together.
Under the plan's testing rule they need an untouched agreement afterwards,
and the four processed agreements stay the review set until then. The
sensible sequence is:

1. Ben confirms the direction below.
2. Assistant drafts legal schema V2: component tree per fact, optional
   timing and qualification roles, a forum role, covenant standard roles,
   consent-deal subtypes, the renamed subtypes above, bring-down tier
   structure, threshold and period components, inherited-language markers.
3. Prompt V7 to emit components with verbatim quotes and inheritance
   markers; extraction validation extended to check each component quote.
4. Rerun NCS only, compare to the 38 touched items, then one untouched
   agreement.

## Direction questions for Ben

1. Component tree per fact, as described, or keep flat roles and add more
   subtypes? The tree is what your comments describe; it is a bigger change.
2. Should the published reader view show the tree (term, then sub-elements)
   or a composed sentence with the tree behind a click?
3. May the two bracketed edits be reverted to pending and recorded as
   comments?
