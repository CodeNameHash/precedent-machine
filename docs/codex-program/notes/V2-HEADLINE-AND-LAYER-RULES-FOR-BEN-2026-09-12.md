# V2 headline and layer rules for Ben's check, 2026-09-12

Status: Ben answered Q1 to Q7 on 2026-09-12 (recorded in `BEN-NCS-REVIEW-COMMENTS-2026-09-09.md`, section 6) and the rules were changed accordingly; Q6 is open. These rules sit in `contracts/product/legal-schema.v2.json` (status `DRAFT_FOR_BEN_REVIEW`) and drive prompt bundle `PRODUCT_LAYERED_COMPONENTS/V7`. The NCS rerun will follow them. Correct anything wrong here before you rely on the rerun output; a wrong rule produces wrong facts for every agreement.

How to read each entry. **Headline** is what the reader sees first: the subtype label plus the components that distinguish this fact from its siblings. **Layers** say how one provision is cut into facts and which components sit under each fact. Every component is verbatim text with a byte range; nothing is paraphrased or invented.

Questions for you are marked Q.

## Termination (7.1)

- Headline: subtype label plus trigger and terminating party. Example: "Termination for breach · Parent · Company breach failing 6.2(a) or (b), uncured".
- Layers: one fact per termination right. Layer 1 is the trigger, the terminating party, the conditions to exercise and when the right expires. Cure mechanics are a branch under the fact: the breach that would fail a condition, curable or not, the cure window measured from notice and capped at the outside date. The closing conditions the breach must fail are cross-references that resolve to the condition text.
- Your 7.1 comments applied: notice period removed as a role (the cure window runs from notice); "outside date cap" renamed cure period end; curability is a branch. Written Consent not delivered and Support Agreement not delivered are their own subtypes, no longer "vote failure". The Novation or Rewind right is "Date-based termination right", not "Outside date".
- Q1: is "trigger plus terminating party" enough in the headline, or should the cure position (curable, uncured) appear there too?

## Termination fee (7.3)

- Headline: subtype label plus payer and amount, or the trigger, or the tail period.
- Layers: one fact per fee amount, one per trigger, one per tail. A trigger with several limbs is one fact with one list element per limb. The tail is one fact whose components are the period, the qualifying event, the look-back condition and any deeming rule (the 20 percent to 50 percent deeming). The fee amount is cross-referenced from every trigger.
- Added subtype "Election to accept or decline fee" for the Company's seven business day election, which V1 held rather than showed.
- Q2: do you want the tail as one fact, or the deeming rule as a separate fact under it?

## No-shop (5.2, 5.3)

- Headline: subtype label plus the duty or permission and its period.
- Layers: one fact per duty. Prohibited actions are one list with one element per verb (solicit, initiate, endorse, encourage, facilitate). Cease discussions, return or destroy, and data-room removal are their own subtypes, not "prohibited action". Notice duties carry the notice contents as list elements. The fiduciary exception carries each prerequisite as a condition. Match periods are period components with canonical values (four business days, two for amendments).
- The Acceptable Confidentiality Agreement definition becomes a key defined term fact.

## Consent solicitation (5.6)

- Headline: subtype label plus the mechanic and its deadline.
- Layers: written-consent deals use "Written consent solicitation", "Written consent delivery" and "Support agreement delivery"; meeting subtypes are not used. Consent Time (11:59 pm Central the day after signing) is a date component. The Consenting Stockholders identity or percentage is a component.
- Q3: should the consent-delivery fact cross-reference 6.1(a), 7.1(c) and 7.3(a)(iii), or should those facts cross-reference 5.6? The contract allows either; the rule currently says nothing.

## Closing conditions (6.1 to 6.3)

- Headline: subtype label plus the condition and its standard.
- Layers: bring-down is one fact per tier. Components: the reps covered (one cross-reference per rep, resolving to the rep heading words), the standard ("in all respects", "in all material respects", de minimis, MAE), the as-of date rule and any scrape. "Remaining reps" tiers list the complement of the other tiers. The tax opinion condition carries the five percent transferee exclusion and the Canadian remittance point as qualifiers, not separate conditions. A chapeau is never a fact. Nasdaq listing is "Listing of shares", not "No legal restraint".
- Q4: for the "remaining reps" tier, do you want the complement listed out, or only the cross-references the text itself makes?

## Antitrust and regulatory (5.8)

- Headline: subtype label plus the obligation and its standard.
- Layers: every covenant fact carries an efforts standard component; a flat "agrees to take all actions" is recorded as that text, so Parent's flat commitment and the Company's reasonable best efforts show side by side. Remedy limitations are one list with one element per action (sale, divestiture, licence, other disposition; restriction, limitation, condition; commence, participate in, defend). Deadlines are period components. This replaces the 41 V1 facts with one fact per obligation.
- Q5: the V1 page had 41 facts here. Is "one fact per obligation, each with its standard" the right cut, or do you want filing, cooperation and remedy as three facts only?

## Material contracts (3.16)

- Headline: subtype label plus category plus threshold plus carve-out. Example: "Material contract category · capital expenditure · over $250,000 · other than in the ordinary course".
- Layers: each category is one fact. Components: the category term, each threshold with its canonical value ($250,000, $750,000, $100,000 become numbers), each carve-out as an exception, and the Disclosure Letter and SEC document limitations inherited from the chapeau and shown as such. Status representations carry the materiality and knowledge qualifiers as components and are not split six ways.
- This is your "topic plus threshold plus carve-out" rule applied.

## Representations with thresholds (Article III)

- Headline: subtype label plus subject plus qualifier plus threshold.
- Layers: each representation limb is one fact. Components: the subject, the standard, each materiality or knowledge qualifier, thresholds, look-back periods and carve-outs as separate components; Disclosure Letter and SEC document limitations inherited from the article intro.

## MAE definition (3.1)

- Headline: subtype label plus the carve-out subject.
- Layers: the definition prong is one fact with components: the affected-matters litany, "individually or in the aggregate", "is or would reasonably be expected to be", the materiality term, the affected-business list and "taken as a whole". Each of the ten carve-outs is one fact; nested inclusions nest. The disproportionality carve-back lists the clauses it applies to as cross-references (clauses 1 to 4 and 7). The Disclosure Letter items exclusion is its own fact.
- Q6: you asked whether each carve-out is a useful separate fact. The rule says yes, with the headline carrying the carve-out subject, so the reader sees ten short lines and opens one. Keep, or fold the ten into one list fact?

## Specific performance (8.10)

- Headline: subtype label plus the agreement or waiver and its standard.
- Layers: one fact per clause; no timing or qualification invented; the court is a forum component; "would occur" versus "may occur" is a standard component. Added subtypes: agreement of irreparable damage, rights are cumulative. Fee-versus-performance coordination stays in 7.3 as "Fee and performance coordination".
- V1 showed six cards; this yields roughly the same count but each with a clear headline.

## Interpretation and boilerplate (8.4)

- Coverage only. Not shown to the reader. Every construction rule gets a category label so boilerplate can be compared across agreements later. This answers your question on the 21 interpretation facts.
- Q7: agree that 8.4 is hidden from the published page entirely?

## What is not in the rules yet

- No family has a rule for how many layers deep the reader can click. The contract allows any depth; the page opens one layer at a time.
- Relationships between facts (a termination right and the fee it triggers) are cross-references inside components, not separate relationship facts. V1 relationship review stays for V1 runs only.
