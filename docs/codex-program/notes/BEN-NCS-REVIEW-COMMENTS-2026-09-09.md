# Ben's NCS review comments, 2026-09-09

Run `eaafcac8-790b-41bb-a5e1-b12187a55e7d`. Comment-style lawyer input, not
review decisions recorded in the app. Ben's words are quoted; anything else is
assistant annotation.

## 1. Termination fee · Fee trigger (Company Termination Fee tail)

Ben: "the tail condition needs analyzing/breaking up."

Annotation: the proposal statement carries the terminating events, the
public Acquisition Proposal condition and the 12-month consummation tail in
one sentence. The TERMINATION_FEE family has a separate TAIL_PERIOD subtype.
Whether a TAIL_PERIOD fact was also emitted for this sentence is unverified
from this session. Ben also reported that the edit form offered "about a
million checkboxes"; that is the citation-selection list, which shows every
span in the closure.

## 2. Termination · Vote failure (Support Agreement non-delivery)

Ben: "this isn't a vote failure it's the failure to deliver a support
agreement - and that error of framing throws the whole provision off."

Annotation: NCS is a written-consent deal (Written Consent, Consent Time,
Support Agreement). The TERMINATION family's subtypes are MUTUAL_CONSENT,
OUTSIDE_DATE, VOTE_FAILURE, BREACH, LEGAL_RESTRAINT, SUPERIOR_PROPOSAL,
RECOMMENDATION_CHANGE, NO_SOLICITATION_BREACH, TERMINATION_NOTICE,
AGREEMENT_VOIDING, PROVISION_SURVIVAL, LIABILITY_RELEASE,
WILLFUL_MATERIAL_BREACH_CARVEOUT and REMEDY_ENTITLEMENT. None covers failure
to deliver a stockholder support agreement or written consent by a deadline,
so the model chose the nearest bucket. This is a schema gap, not only a model
error. `docs/core/LEGAL-RULES.md` does not mention written-consent deals.

## 3. General

Ben: "I'd rather give comment style answers if possible? And rather focus on
a few provisions which either you are worried about or which are material in
a contract and go from there?"

Annotation: the app has no per-item comment field; decisions are accept,
edit, reject or unresolved only. Comments are being captured here.

## 4. Termination · Breach (7.1(c)(i) or (d)(i)), saved in the app 2026-09-12 19:11 UTC

Ben (comment stored on the fact, revision 1): "Some issue here. Not sure why
we show notice period - there is no notice period, it is just part of the
cure period? Also, incurability is a bit odd as shown - I'd think of this as
a flow diagram - there is a materai lbreach - is it curable - if yes, you go
to the cure period and if not - you go another way.  Are we tracking that
properly?  Also I don't know why the outside date cap item is completed? The
outside date is referenced but as pthe end of the cure period? Also need to
make sure we're picking up which closing conditions are cross referened"

Annotation: the TERMINATION / BREACH subtype in `legal-schema.v1.json`
has required roles terminating_party, breaching_party, action,
breach_subject, closing_condition_failure_standard and optional roles
incurability, cure_period, notice_period, outside_date_cap,
terminator_breach_bar. The model filled every optional role from the same
sentence: notice_period holds "30 days after the giving of written notice",
which is the cure period measured from notice, not a separate notice
period; outside_date_cap holds "the Outside Date" because the cure period
ends at the earlier of the Outside Date and 30 days. The schema stores
these as flat text roles, so the flow Ben describes (breach that would fail
a condition, curable or not, cure window, then the right) is not modelled
as a sequence. Closing-condition cross-references (Sections 6.1 and 6.2)
are text inside closing_condition_failure_standard; no relationship links
the termination right to the 6.x condition facts, and the six REQUIRES
links the model proposed inside 7.1 were rejected because REQUIRES is not
allowed from those subtypes. Whether the BREACH roles should be
restructured (drop notice_period, rename outside_date_cap, model
curability as a branch) and whether condition cross-references should
become links are schema decisions for Ben.

## 5. Full pass on the focused page, 2026-09-12 19:11 to 20:10 UTC (revision 45)

Read from the private preview database. 38 items touched: 35 comments, 2 edits, 3 marked unresolved. Ben's words are quoted exactly; nothing else is his.

### 3.1 · exclusion · pending
Fact: "For purposes of this Agreement, Material Adverse Effect shall not include any event, change, circumstance, occurrence, effect or state of facts to the extent resulting from seasonal fluctuations in revenue or earnings."

Ben: "key point her eis just "seasonal fluctuation in revenue of earnings" - should also be clear when you present stuff what is inherited.  And also when you show the text I'd be clear with a marker that you have created a fusion provision from the intro then [...] etc. Maybe that's how to do it - put it in " " but with [...] where oyu have skipped lanugage and then start with the 10"

### 3.1 · exclusion · pending
Fact: "For purposes of this Agreement, Material Adverse Effect shall not include any event, change, circumstance, occurrence, effect or state of facts to the extent resulting from geopolitical conditions or changes that are the…"

Ben: "again, a bit like the intro section, I'd sub divided operative object a little bit - look across other deals (which you can probably do once you pass through these comments) and try and figure out the lines of seprateoin but it is likely similar t othe intro - i.e. (i) there is a litany of "any event, change, circumstance, occurrence, effect or state of facts" and (ii) then "to the extent resulting from " and then (iii) "geopolitical conditions or changes that are the result of the outbreak, conduct or escalation of war (whether declared or undeclared) or acts of terrorism or sabotage (including cyber-attacks)" with the (iii) being the real point of comparison across different drafts but the others also have some lower value.  And so we should track each of the following as separate items - first the overall term (1) "geopolitical conditions or changes that are the result of " and then (2) each of the following "the outbreak, conduct or escalation of war (whether declared or undeclared)" and " acts of terrorism" and "[acts of or sabotage] and " (including cyber-attacks)" and be clear that including cyber attacks must be a sub part of sabotage."

### 3.1 · disproportionality carveback · pending
Fact: "For purposes of this Agreement, with respect to clauses (1), (2), (3), (4) and (7), the exclusions do not apply where the impact of such event, change, circumstance, occurrence, effect or state of facts is disproportiona…"

Ben: "Good."

### 3.1 · exclusion · pending
Fact: "For purposes of this Agreement, Material Adverse Effect shall not include any event, change, circumstance, occurrence, effect or state of facts to the extent resulting from the announcement or pendency of the transaction…"

Ben: "again, need to track the following as separate items for comparison:
"the announcement" and "pendency" of the transactions contemplated by this Agreement and then note there is an including thne list out each of "any litigation, claim or proceeding arising from allegations of a breach of fiduciary duty or other violation of applicable securities Laws relating to this Agreement and the transactions contemplated hereby" and "the identity of Parent or any of its Subsidiaries" with a note that there is a neslted including list of "impact of the foregoing on the relationships, contractual or otherwise, of the Company and any of its Subsidiaries" with and then list each of the with's as separate items for tracking too "customers" "suppliers" "service providers" "Governmental Entities" or "any other Persons"

This logic needs flowing through all of these MAE limbs and likely through reps and other parts too. This should allow quick comparison between deals, no?"

### 3.1 · definition prong · pending
Fact: "For purposes of this Agreement, “Material Adverse Effect” means any event, change, circumstance, occurrence, effect or state of facts that, individually or in the aggregate, is or would reasonably be expected to be mater…"

Ben: "i'd like to break this up into "nay event, change, circumstance, occurrence, effect or state of facts" and "that, individually or in the aggregate, is or would reasonably be expected to be" and "materially adverse" and "to the business, assets, liabilities, condition (financial or otherwise) or results of operations of the Company and its Subsidiaries" with "taken as a whole" looped back in with individually or in the aggregate. Can remain as operative objet but each piece should be tracked so we can compare it."

### 3.16 · material contract category criterion · pending
Fact: "A material Contract not entered into in the ordinary course of business between the Company or any of its Subsidiaries, on the one hand, and any Affiliate thereof other than any Subsidiary of the Company, is a listed Mat…"

Ben: "we should split out "any material Contract" and "not entered into in the ordinary course of business"

Also in re: the operative object - and legal actor, you have it all wrong, no? THe actors are the co and its subs on one hand and any affilaute on the other. the object is a material contract not entereed into in the..."

### 3.16 · material contract category criterion · pending
Fact: "A Contract that by its terms calls for aggregate payment or receipt by the Company and its Subsidiaries under such Contract of more than $750,000 over the remaining term of such Contract is a listed Material Contract cat…"

Ben: "again - $750k should be called out as a separate item. and the category should be "aggregate payment or receipt" or similar"

### 3.16 · material contract category criterion · unresolved
Fact: "A Contract pursuant to which the Company or any of its Subsidiaries has assumed any liability or obligation of any Person, in excess of $250,000, including take-or-pay contracts or keepwell agreements, is a listed Materi…"

Ben: "So this is messed up. It's an indebtedness type provision and we should be saying its any loan etc (each as separate items) which are in excess of $250k and we sohuld note the specific inclusions.  I think this a similar issue to the other parts I've reviewed so make sure your changes are systematic."

### 3.16 · material contract disclosure list · pending
Fact: "Except as set forth in specified Company SEC Documents or the Company Disclosure Letter, the Company represents and warrants to Parent and Merger Sub that Section 3.16 of the Company Disclosure Letter lists each Contract…"

Ben: "You should also inherit the limitations on the company SEC documents etc"

### 3.16 · material contract category criterion · pending
Fact: "A Contract that contains an exclusivity or “most favored nation clause” that restricts the business of the Company or any of its Subsidiaries, taken as a whole, in a material manner, is a listed Material Contract categor…"

Ben: "I don't understnd why "Legal operation
is of a type listed in Section 3.16 of the Company Disclosure Letter" is shown.  Legal actor - there isn't one.

What we should be pciking up here is (1) "materially limits the ability of the Company or any of its Subsidiaries to..." (i) compete in any line of business" or (ii) with any Person or in any geographic area" and (2) "materially restricts the right of the Company and its Subsidiaries to" (i) "sell to or purchase from any Person" or ((ii) "to hire any Person" or (3) "that contains" (i) an exclusivity or (ii) "most favored nation clause” - that in each case of (i) and (ii) (x) restricts the business of the Company or any of its Subsidiaries, taken as a whole, (y) in a material manner;

You can track things like the material manner as a qualifier to the restricts the busienss etc but that's the sort of analysis you need to do."

### 5.2 · prohibited action · pending
Fact: "If at any time the Company provides any non-public information to a third party in compliance with Section 5.2(c) and the Company Board subsequently determines that the Acquisition Proposal made by such third party is no…"

Ben: "This should becalled soemthing like subsequent removal of VDR access. and same for the prior one re: taking back the confi stuff provided"

### 5.2 · prohibited action · pending
Fact: "Subject to Section 5.2(c), the Company shall, and shall cause each of its Subsidiaries and the Representatives of the Company and its Subsidiaries to, request the prompt return or destruction of all confidential informat…"

Ben: "this isn't a prohibited action this is return or destroy requirement.  need to track 6 month period as well - take a fresh look at how you carved this up."

### 5.2 · notice update obligation · pending
Fact: "From and after the date hereof and prior to the Company’s receipt of the duly executed Written Consent, the Company shall promptly, but in no event later than 48 hours after receipt, provide Parent summaries of all mater…"

Ben: "as noted in MAE and the reps, you should break down the specific items that must be provided - that is the core of a comparison."

### 5.2 · prohibited action · pending
Fact: "Except as expressly permitted by Section 5.2(c), from the date hereof and prior to the earlier of the Effective Time or the termination of this Agreement in accordance with its terms, the Company shall not, and shall not…"

Ben: "not sure where to put this but in re: your question - there is a definition of acceptable confi agreemnet in 5.2(e)(iii):

(iii) “Acceptable Confidentiality Agreement” means an agreement with the Company that contains provisions that require any counterparty thereto (and any of its Affiliates and Representatives) that receive information of, or with respect to, the Company or its Affiliates, to keep such information confidential; provided that, (A) in each case, the substantive provisions contained therein are no less favorable in any material respect in the aggregate, to the Company, than the terms of the Confidentiality Agreement, and (B) that an “Acceptable Confidentiality Agreement” shall not include any provision (1) granting any exclusive right to negotiate with such counterparty (2) prohibiting the Company or any of its Affiliates from satisfying its or their obligations hereunder or (3) requiring the Company or any of its Subsidiaries to pay or reimburse the counterparty’s fees, costs or expenses."

### 5.6 · document filing · pending
Fact: "Immediately after the execution of this Agreement and in lieu of calling a meeting of the Company’s stockholders, the Company shall submit the form of Written Consent attached hereto as Exhibit A and the Consenting Stock…"

Ben: "not sure whre to write this comment but agree that overall this ais a written consetn deal."

### 5.8 · burden · pending
Fact: "Notwithstanding anything to the contrary in this Agreement, neither Parent, the Company nor any of their respective Subsidiaries shall be required, in connection with obtaining any regulatory approval or clearance contem…"

Ben: "agreed but I'd subdivide the list of sale, divestiture etc"

### 5.8 · cooperation · unresolved
Fact: "Upon the terms and subject to the conditions set forth in this Agreement, Parent agrees to take, or cause to be taken, all actions that are necessary, proper or advisable to obtain all required consents, approvals or wai…"

Ben: "I wouldn't say this is "cooperation" I'd say this is efforts standards... agree Parent obligation is flat and company is RBE.  where you have a covenant obligation you should track if thre is a materiality qualifier or efforts qualifier."

### 5.8 · burden · pending
Fact: "Notwithstanding anything to the contrary in this Agreement, neither the Company nor any of its Subsidiaries, without the prior written consent of Parent, shall propose, negotiate, offer to commit, effect, or agree to the…"

Ben: "this isn't a burden it is a restriction on being able to propose negotiated etc...."

### 5.8 · litigation · pending
Fact: "Notwithstanding anything to the contrary in this Agreement, neither Parent, the Company nor any of their respective Subsidiaries shall be required, in connection with obtaining any regulatory approval or clearance contem…"

Ben: "i'd call this obligation to litigate"

### 6.2 · bringdown · pending
Fact: "The obligation of Parent and Merger Sub to effect the Merger is subject to the satisfaction, or waiver by Parent, at or prior to the Effective Time, that each of the representations and warranties of the Company set fort…"

Ben: "need to clearly pick up "true and complete in all material respects" as the key test here. Also need to be able to say what these provisions are (not just headings because there might not be one for the specific limb of (c)""

### 6.2 · bringdown · pending
Fact: "The obligation of Parent and Merger Sub to effect the Merger is subject to the satisfaction, or waiver by Parent, at or prior to the Effective Time, that each of the remaining representations and warranties of the Compan…"

Ben: "as below, need to make sure you know which are the "remaining reps" - i.e. look at all numbesr of the reps and remove the reps you have listed in the other bringdowns."

### 6.2 · bringdown · pending
Fact: "The obligation of Parent and Merger Sub to effect the Merger is subject to the satisfaction, or waiver by Parent, at or prior to the Effective Time, that each representation and warranty of the Company set forth in Secti…"

Ben: "you are missing "true and correct" but otherwise tine."

### 6.2 · bringdown · pending
Fact: "The obligation of Parent and Merger Sub to effect the Merger is subject to the satisfaction, or waiver by Parent, at or prior to the Effective Time, that each of the representations and warranties of the Company set fort…"

Ben: ""in all material respects" i s they key"

### 6.3 · tax opinion · pending
Fact: "Notwithstanding the foregoing Tax Opinion condition, no opinion will be expressed regarding the U.S. federal income tax treatment of any stockholder of the Company that is a “five-percent transferee shareholder” within t…"

Ben: "This is not a condition in and of itself it is sort of a qualifier to the tax condition and I'd track it as such."

### 6.3 · bringdown · pending
Fact: "The obligation of the Company to effect the Merger is subject to the satisfaction, or waiver by the Company, at or prior to the Effective Time, of the condition that each of the remaining representations and warranties o…"

Ben: "we say "remaining here" but "remaining" as compared to what? I think it is better to track this with the bringdown generally or all reps so it is clear. And you will need to track the reps and their bringdown and any exlcusions/modifications per group of reps but this should be done, as I said, all otgeter."

### 6.3 · bringdown · pending
Fact: "The obligation of the Company to effect the Merger is subject to the satisfaction, or waiver by the Company, at or prior to the Effective Time, of the condition that each of the representations and warranties of Parent a…"

Ben: "on the final viewable summary page, we will need 4.8 and 4.11 to be spelled out what reps they are rather than the x-refs."

### 7.1 · breach · pending
Fact: "This Agreement may be terminated and the Merger may be abandoned at any time prior to the Effective Time, whether before or after the Written Consent has been obtained, by the Company if Parent or Merger Sub breaches, fa…"

Ben: "Some issue here. Not sure why we show notice period - there is no notice period, it is just part of the cure period? Also, incurability is a bit odd as shown - I'd think of this as a flow diagram - there is a materai lbreach - is it curable - if yes, you go to the cure period and if not - you go another way.  Are we tracking that properly?  Also I don't know why the outside date cap item is completed? The outside date is referenced but as pthe end of the cure period? Also need to make sure we're picking up which closing conditions are cross referened"

### 7.1 · outside date · pending
Fact: "This Agreement may be terminated and the Merger may be abandoned at any time prior to the Effective Time, whether before or after the Written Consent has been obtained, by the Company if the Novation contemplated by Sect…"

Ben: "I don't think we're quite getting this right.  The termination right is available after11.59pm CT on the day followin gthe closing of REwind but only if the Novation is not effecitve then and proivded that the Company cannot terminate if the Novation is delivered and effective.  Also this is not linked to the Outside Date and shouldn't be coded as such - there are other date related termination rights you see from time to time."

### 7.1 · vote failure · edited
Fact: "This Agreement may be terminated and the Merger may be abandoned at any time prior to the Effective Time, whether before or after the Written Consent has been obtained, by Parent if the Support Agreement, duly executed b…"

Ben's edit (statement unchanged; notes written into role fields):
- required_vote: "the Support Agreement, duly executed by the Consenting Stockholders [[need to track the % or identiy of these and let me be able to mouse it over in place on production page.]]"
- adjournment_scope: "[[there is no adjournment scope - I' wouldn't track this as voting failure but delivery of voting and support agreemnets.  You can track the written consent as a vote failure but you should (i) be clear if a vote beyond the written ocnsent its trequired and (ii) add for both this one and the written consent different categories for items here which track a written consent rather than a meeting mechanic]]"

### 7.1 · legal restraint · edited
Fact: "This Agreement may be terminated and the Merger may be abandoned at any time prior to the Effective Time, whether before or after the Written Consent has been obtained, by either Parent or the Company if any court of com…"

Ben's edit (statement unchanged; notes written into role fields):
- restraint_kind: "any court of competent jurisdiction or other Governmental Entity [[I'd pull out the issuing body as a separate point we track - sometimes you see competent jurisdiction, sometimes not]] shall have issued a judgment, order, injunction, rule or decree, or taken any other action restraining, enjoining or otherwise prohibiting"
- finality_standard: " final and nonappealable"

### 7.3 · fee trigger · pending
Fact: "The Company shall pay, or cause to be paid, the Company Termination Fee if this Agreement is terminated by Parent pursuant to Section 7.1(c)(i) or by either the Company or Parent pursuant to Section 7.1(b)(i), a bona fid…"

Ben: "triggers should be broke nout - i.e. each trigger is a separate fact (see similar comments in MAE and no solicit etc). tail condition needs breaking out into its constituent parts (again, as noted elsewhere, comparing across deals may help to find the seams of comparison). we don't pick up here the $ amount?"

### 8.10 · remedy coordination · pending
Fact: "All rights to an injunction, specific performance and other equitable relief to prevent breaches of this Agreement and to enforce specifically the terms and provisions hereof shall be cumulative."

Ben: "Not sure why you're inheriting the DE couty here?  There is no timing or trigger here - this is the provision of a right."

### 8.10 · non objection · pending
Fact: "Each of the Parties waives any defense in any action for specific performance that a remedy at law would be adequate."

Ben: "see prior comments"

### 8.10 · general equitable relief · pending
Fact: "Accordingly, the Parties acknowledge and agree that each Party shall be entitled to an injunction, specific performance and other equitable relief to prevent breaches of this Agreement and to enforce specifically the ter…"

Ben: "ACcordingly is not a timing point.  Also I'd call this "Agreement to equitable relief" and I wouldn't put DE courts as a qualification but a forum."

### 8.10 · remedy coordination · unresolved
Fact: "The Parties acknowledge and agree that the provisions of Section 7.3, including the availability of the Company Termination Fee or the Parent Termination Fee, will not be construed to diminish or otherwise impair in any …"

Ben: "no timing element here - is the issue that yo uthink you must have a timing element?"

### 8.10 · general equitable relief · pending
Fact: "The Parties agree that irreparable damage would occur in the event that the Parties do not perform the provisions of this Agreement in accordance with its terms or otherwise breach such provisions."

Ben: "I'd call this "Agreement of irreparable damage" and make sure you track the "would occur" as sometimes you see "may occur""

### 8.10 · bond security waiver · pending
Fact: "Each of the Parties waives any requirement under any law to post security as a prerequisite to obtaining equitable relief."

Ben: ""as a pre-requisite" is not a timing or trigger. Also not sure I'd call under any law a qualification."

### 8.4 · construction · pending
Fact: "When a reference is made in this Agreement to a Section, Article, Exhibit or Schedule, such reference shall be to a Section, Article, Exhibit or Schedule of this Agreement unless otherwise indicated."

Ben: "For all of these, they are not "front line" issues but you should come up with a category for each of them so we can compare them in the future."


## 6. Answers to the V2 rules note, 2026-09-12 (verbatim)

Ben's answers to the seven questions in `V2-HEADLINE-AND-LAYER-RULES-FOR-BEN-2026-09-12.md`:

- "Q1 - I'd include cure right and if three are exceptions / conditions - e.g. you cab't terminate if you primarly caused the outside date not to be met"
- "Q2 - amount, payer, trigger and I'd note there is a deeming mechanicsm as it is unusual"
- "Q3 - I'd not x-ref the termination etc"
- "q4 - just say other reps in the text but I want the system to know what each rep is brought down to so that the rep can show that in the rep table"
- "q5) present them all and we can see on the page.  The old app should be a guide as well"
- "Q6) not 100% sure what you are asking"
- "q7) has it as an expandable section"

Applied 2026-09-12 in `scripts/product/build-legal-schema-v2.js` (Termination headline adds cure right and conditions or exceptions; Termination fee headline is amount, payer, trigger, with the deeming mechanism named on a tail; consent facts do not cross-reference termination, conditions or fees; the "other reps" tier keeps the words of the text and carries one resolved cross-reference per representation; antitrust presents every obligation; boilerplate is a collapsed expandable section on the published page). Q6 re-asked as ten separate one-line carve-out facts versus one list fact; Ben: "show all the carve outs". Each carve-out stays its own fact, all visible on the page; the rule is unchanged.

## 7. Query mockup feedback, 2026-09-12 23:15 UTC (verbatim)

On the first Query mockup (headline = subtype label plus distinguishing components, rows keyed by section reference):

"headlines are okay but completely wrong in terms of what they're focused on. For example employee compensation - it should say Each Assumed RSU is assumed by Parent and continues on the same terms and explain what an Assumed RSU is..."

"also the site should be provision/subjet matter drien you don't need the section references, who cares."

"GO back and look at the current system for hints on how this should work/look"

Implications recorded by the assistant, not decided: the headline must read as the operative proposition (actor, operation, object, then the qualifier that matters), with defined terms explained on demand; distinguishing-component headlines built from thresholds and triggers alone read as fragments. Navigation is by provision and subject matter; section references move to the source layer. The legacy site's provision presentation is the reference for shape.

## 8. Query mockup, second and third rounds, 2026-09-12 23:25 to 23:35 UTC (verbatim)

On mockup 2 (sentence headlines, Term / Provision table): Ben sent screenshots of the current review page (Structure & Mechanics, Consideration, Equity Awards, Representations, Interim Operating Covenants, No-Shop, Votes, Employee Compensation and Benefits) and wrote: "see attached - how tables were used to show similar data across ariavles etc. Not full drafting but just the headline conclusions. votes section looks particualrly good. as does employee benefits (see next message)> can you revise in this vain?"

On mockup 3 (per-subtype pill tables, with a hand-composed target table and the gap that V2 has no per-subtype table shape or coded vocabulary): "we need to layer into the design the "we hav rthe backup" features of this new structure - i.e. show the evidence and all of the hard work behidn the scenes!!"
