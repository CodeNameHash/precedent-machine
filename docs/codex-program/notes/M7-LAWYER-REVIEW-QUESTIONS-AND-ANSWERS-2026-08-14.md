# M7 lawyer review questions and answers

**Date:** 14 August 2026

**Purpose:** Exact human-review context for the M7 core semantic repair and Fable adversarial review.

**Authority:** The JSON packet and decision ledger remain authoritative. This Markdown file is a readable transcript.

Ben's notes are reproduced verbatim, including spelling and punctuation. Invisible
trailing spaces are removed from this readable copy. No answer was changed. The
repair class is a programme diagnosis added after the review.

## 1. Authoritative records

- [Review packet](../../../evidence/canonical-v2/stage-2y-structure-migration/shadow/m7-comparison-entry-correction/lawyer-review-packet.json)
- [Decision ledger](../../../evidence/canonical-v2/stage-2y-structure-migration/shadow/m7-comparison-entry-correction/lawyer-decision-ledger.json)
- [Core repair plan](./M7-CORE-SEMANTIC-REPAIR-PLAN-2026-08-14.md)
- Fixed corpus digest: `b8825b712ab905a175cfc4a86c3504705f1d8bf509ddcee40f951764c3cf6e3d`
- Review packet ID: `1508b03c8c081cc208ab5115e7bd7c369e4165d69d4115e665c30f25af8a679d`
- Decision ledger ID: `7a23e0073de1ccb366710931fafde9f863b4a942574bd9ada005f22dacfd5e3f`
- Final gate: `FAILED_RETURN_AFFECTED_ITEM_TYPES_FOR_REPAIR`

## 2. Programme-wide M5 questions and Ben's answers

These questions were first shown under `EMPLOYEE_MATTERS`. Ben ruled that the same answers apply to all 25 families.

### Programme question 1

> When one sentence or numbered clause contains several connected duties, should Corpus keep the connected wording together or turn each separate duty into a linked comparison item?

- Answer: `ONE_COMPOUND_PROPOSITION`
- Label shown to Ben: `Keep each legal unit together`
- Final meaning: One independently operative authored limb is one legal rule. Connected components can stay together. Each limb retains its own standard, conditions and exceptions.

### Programme question 2

> A fact from this clause may also matter to another comparison topic. Should Corpus save one authoritative version and show it in both places, or save a separate copy under each topic?

- Answer: `ONE_OWNER_WITH_LINKED_CONSUMERS`
- Initial note: `I don't quite follow what you mean, each limb here has a different standrard, each limb should track its' own standard`
- Final clarification accepted by Ben: This question concerns duplicate storage across families. It does not merge limbs with different standards. Save the legal fact once under its proper family, then let other families display it through a stable link.

### Programme question 3

> If the clause does not prove which definition, cross-reference or condition supplies a required fact, should Corpus use the most likely meaning or leave only that comparison item incomplete?

- Answer: `FAIL_ONLY_THE_DEPENDENT_PROPOSITION`
- Label shown to Ben: `Leave only that item incomplete`
- Ben's note: `And flag the absence / ambiuity`
- Final meaning: Do not guess. Mark and flag only the dependent legal rule as incomplete or ambiguous.

## 3. M7 card-by-card questions and answers

The three repeated questions in this packet were:

1. Source-to-row: `Does this comparison row preserve the important legal meaning of the source clause?`
2. Review-only: `Is it correct to keep this item out of the normal comparison because an important fact is missing or unclear?`
3. Parser: `Is it correct to flag this source structure and block only a comparison item that depends on the unclear wording?`

The V2 review must retain the broad legal-meaning question, add an explicit family-and-subtype question, and supplement both with subtype-specific field questions.

### 1. EMPLOYEE_MATTERS, SOURCE_TO_ROW

- Agreement: Red Hat / IBM
- Agreement ID: `06ec301641939fe0ac6e6ba598a33b40f16b1acc3ffb29109c7227b14bf1025a`
- Review item ID: `502ed0b71e8378d67cd763ec0f1a0b46cf0db45731c0b6aeea03049810bc1476`
- Failed row ID: `3c83f0b3df9693e5c263c2399c4ae17585da7c5bf7f7dbf94f2e0b946be7c588`
- Section reference: Not recorded
- Ben's decision: `CORRECT`
- Repair class: `MATERIAL_MEANING_OMITTED_OR_HIDDEN`

**Question shown to Ben**

> Does this comparison row preserve the important legal meaning of the source clause?

**Source excerpt**

~~~~text
Parent or its applicable affiliates shall, unless prohibited by applicable Law give, or cause to be given, to Continuing Employees credit for purposes of eligibility to participate (other than any defined benefit pension, post-employment health benefits or post-employment welfare benefits plan), vesting and, with respect to severance and vacation benefits only, determining level of benefits, but not for benefit accrual, under employee benefit plans maintained by Parent or its affiliates and in which such employees participate after the Closing, for such employees’ service prior to the Closing with the Company or any of its Subsidiaries, to the same extent recognized by the Company and its Subsidiaries prior to the Closing.
~~~~

**Compact comparison shown**

~~~~text
Comparison point: Employee service credit
~~~~

**Expanded comparison shown**

~~~~text
Comparison point: Employee service credit
Applies to: Parent or its applicable affiliates
~~~~

**Ben's note, verbatim**

~~~~text
Missing "to the same extent recognized by the Company and its Subsidiaries prior to the Closing."
~~~~

**Required repair disposition**

Add subtype-required fields and source coverage. The repaired rule must expose every material condition, exception, scope, party and timing term identified by Ben.

### 2. TERMINATION, SOURCE_TO_ROW

- Agreement: Red Hat / IBM
- Agreement ID: `06ec301641939fe0ac6e6ba598a33b40f16b1acc3ffb29109c7227b14bf1025a`
- Review item ID: `f59080c78069bb26b90ac32b68a66af32fd53f36a45bdfae2d6e0986f9241112`
- Failed row ID: `2cafd55d128d115d012089a467cbb8bbef7c130aea1d3e35d2aa4918cc55cb19`
- Section reference: `7.01`
- Ben's decision: `CORRECT`
- Repair class: `MATERIAL_MEANING_OMITTED_OR_HIDDEN`

**Question shown to Ben**

> Does this comparison row preserve the important legal meaning of the source clause?

**Source excerpt**

~~~~text
by Parent, if the Company shall have breached any of its representations or warranties or failed to perform any of its covenants or other agreements contained in this Agreement, which breach or failure to perform (i) would give rise to the failure of a condition set forth in Section 6.02(a) or Section 6.02(b) and (ii) (A) is incapable of being cured prior to the Termination Date or (B) is not cured by the Company on or before the earlier of (i) the Termination Date and (ii) the date that is thirty (30) Business Days after written notice from Parent of such breach or failure; provided that Parent shall not have the right to terminate this Agreement pursuant to this Section 7.01(d) if Parent or Sub is then in material breach of this Agreement or if any representation or warranty of Parent or Sub shall have become untrue, in either case, so as to result in the failure of any of the conditions set forth in Section 6.03(a) or Section 6.03(b);
~~~~

**Compact comparison shown**

~~~~text
Comparison point: Termination right grant
~~~~

**Expanded comparison shown**

~~~~text
Comparison point: Termination right grant
Applies to: Parent
Key facts: Party that may terminate: Parent; Trigger: Breach
~~~~

**Ben's note, verbatim**

~~~~text
No - it gets it generally right but misses specifics. First it misses the pre-requisites "(i) would give rise to the failure of a condition set forth in Section 6.02(a) or Section 6.02(b) and (ii) (A) is incapable of being cured prior to the Termination Date or (B) is not cured by the Company on or before the earlier of (i) the Termination Date and (ii) the date that is thirty (30) Business Days after written notice from Parent of such breach or failure". And then it misses the proviso "provided that Parent shall not have the right to terminate this Agreement pursuant to this Section 7.01(d) if Parent or Sub is then in material breach of this Agreement or if any representation or warranty of Parent or Sub shall have become untrue, in either case, so as to result in the failure of any of the conditions set forth in Section 6.03(a) or Section 6.03(b);"
~~~~

**Required repair disposition**

Add subtype-required fields and source coverage. The repaired rule must expose every material condition, exception, scope, party and timing term identified by Ben.

### 3. GENERAL_COVENANTS, SOURCE_TO_ROW

- Agreement: Red Hat / IBM
- Agreement ID: `06ec301641939fe0ac6e6ba598a33b40f16b1acc3ffb29109c7227b14bf1025a`
- Review item ID: `63615db9caffe05414a7c9541fdc89ac58774a36d790b1ff8d1513bd27dd4fd8`
- Failed row ID: `47bd636dd77480b5b20adaa8c4fc870a72601fcf05faade41e710f9cf759af31`
- Section reference: `5.09`
- Ben's decision: `CORRECT`
- Repair class: `CLEAN_CONTROL`

**Question shown to Ben**

> Does this comparison row preserve the important legal meaning of the source clause?

**Source excerpt**

~~~~text
Prior to the Effective Time, the Company shall cooperate with Parent and use its reasonable best efforts to take, or cause to be taken, all actions and do, or cause to be done, all things reasonably necessary, proper or advisable on its part pursuant to applicable Law and the rules and regulations of NYSE to cause (a) the delisting of the Company Common Stock from NYSE as promptly as practicable after the Effective Time and (b) the deregistration of the Company Common Stock pursuant to the Exchange Act as promptly as practicable after such delisting.
~~~~

**Compact comparison shown**

~~~~text
Comparison point: Stock exchange listing and delisting covenant
~~~~

**Expanded comparison shown**

~~~~text
Comparison point: Stock exchange listing and delisting covenant
Applies to: the Company
Key facts: Covenant obligor: the Company
~~~~

**Ben's note, verbatim**

~~~~text
None.
~~~~

**Required repair disposition**

Keep this source identity fixed and prove that the repair does not regress it.

### 4. CLOSING_CONDITIONS, SOURCE_TO_ROW

- Agreement: Red Hat / IBM
- Agreement ID: `06ec301641939fe0ac6e6ba598a33b40f16b1acc3ffb29109c7227b14bf1025a`
- Review item ID: `dfd72643d27a50176595bedfbfe525b65e8bca52a64aab3149a257a5467b6b21`
- Failed row ID: `28858519309984853ae68f640bc24328dbbf3a81ef1f2c86651a15bc0bd230a5`
- Section reference: `6.01`
- Ben's decision: `INCORRECT`
- Repair class: `MATERIAL_MEANING_OMITTED_OR_HIDDEN`

**Question shown to Ben**

> Does this comparison row preserve the important legal meaning of the source clause?

**Source excerpt**

~~~~text
(i) No temporary restraining order, preliminary or permanent injunction or other Judgment or Law of, or issued by, any court of competent jurisdiction or other Governmental Entity shall be in effect, in each case having the effect of making the Merger illegal or otherwise prohibiting consummation of the Merger or imposing, individually or in the aggregate, a Burdensome Condition (collectively, “Legal Restraints”) and
~~~~

**Compact comparison shown**

~~~~text
Comparison point: Legal restraint condition
~~~~

**Expanded comparison shown**

~~~~text
Comparison point: Legal restraint condition
Applies to: Either Principal Party
~~~~

**Ben's note, verbatim**

~~~~text
Can't see the chapeau but I think it is right
~~~~

**Required repair disposition**

Add subtype-required fields and source coverage. The repaired rule must expose every material condition, exception, scope, party and timing term identified by Ben.

### 5. MAE_DEFINITION, SOURCE_TO_ROW

- Agreement: Red Hat / IBM
- Agreement ID: `06ec301641939fe0ac6e6ba598a33b40f16b1acc3ffb29109c7227b14bf1025a`
- Review item ID: `2ad873af98a090151607077ca0bb92d104bab9dbf4b2495bb114c1c5e8343817`
- Failed row ID: `3958a569264795516373ca772935a1087a7c3c1533bf50acdd51986c8a4d423e`
- Section reference: `8.03(l)`
- Ben's decision: `CORRECT`
- Repair class: `CLEAN_CONTROL`

**Question shown to Ben**

> Does this comparison row preserve the important legal meaning of the source clause?

**Source excerpt**

~~~~text
(i) result in a material adverse effect on the business, assets, properties, financial condition or results of operations of the Company and its Subsidiaries, taken as a whole or
~~~~

**Compact comparison shown**

~~~~text
Comparison point: MAE definition prong
~~~~

**Expanded comparison shown**

~~~~text
Comparison point: MAE definition prong
Applies to: the Company and its Subsidiaries
Key facts: Defined party: the Company and its Subsidiaries; MAE prong: Business effects
~~~~

**Ben's note, verbatim**

~~~~text
None.
~~~~

**Required repair disposition**

Keep this source identity fixed and prove that the repair does not regress it.

### 6. KEY_DEFINED_TERMS, SOURCE_TO_ROW

- Agreement: Red Hat / IBM
- Agreement ID: `06ec301641939fe0ac6e6ba598a33b40f16b1acc3ffb29109c7227b14bf1025a`
- Review item ID: `78afa3317c02f6ccecd93fda2739e0dd78cdf22afe47df7cd4c367cf4286ab6b`
- Failed row ID: `0ab39315762581a35dc3e1abff63f26820e1f5b75c4d99077dbcf63aa40a6ff8`
- Section reference: `8.03`
- Ben's decision: `INCORRECT`
- Repair class: `MATERIAL_MEANING_OMITTED_OR_HIDDEN`

**Question shown to Ben**

> Does this comparison row preserve the important legal meaning of the source clause?

**Source excerpt**

~~~~text
“Willful Breach” means, with respect to any agreement or covenant in this Agreement, an act or omission (including a failure to cure circumstances) taken or omitted to be taken that the breaching party intentionally takes (or intentionally fails to take) and knows (or reasonably should have known) would, or would reasonably be expected to, cause a material breach of such representation, warranty, agreement or covenant.
~~~~

**Compact comparison shown**

~~~~text
Comparison point: Willful breach knowledge standard [1 linked point in full row]
~~~~

**Expanded comparison shown**

~~~~text
Comparison point: Willful breach knowledge standard
Comparison point: Willful breach definition
Key facts: Defined term identity: willful breach; Standard: Actual or constructive; Definition wording: an act or omission (including a failure to cure circumstances) taken or omitted to be taken
~~~~

**Ben's note, verbatim**

~~~~text
Key facts - what is important here is that it is doubel knowledge -y ouh ave to know it was a material breach with intention.  Key point just for this one definition
~~~~

**Required repair disposition**

Add subtype-required fields and source coverage. The repaired rule must expose every material condition, exception, scope, party and timing term identified by Ben. For this definition, preserve an `ALL_OF` relationship between the intentional act-or-omission branch and the knowledge-and-causation branch. The knowledge choice must scope over the stated material-breach causation alternatives. A flat list of intent and knowledge facts is not complete.

### 7. REPRESENTATIONS, SOURCE_TO_ROW

- Agreement: AbbVie / Landos
- Agreement ID: `f4a123d7c2bd8ba6358499dd9870513c8bac6a6893985bf5a581a536af280d71`
- Review item ID: `89972a9423fcfc902fad7ecf07233181b46a8728e38609dfe614cb221a642e8c`
- Failed row ID: `020ea123a3df1e0b05c07136323f9a976e55b7e968c29f20cded4f627bcff890`
- Section reference: `3.5(a)`
- Ben's decision: `INCORRECT`
- Repair class: `MATERIAL_MEANING_OMITTED_OR_HIDDEN`

**Question shown to Ben**

> Does this comparison row preserve the important legal meaning of the source clause?

**Source excerpt**

~~~~text
As of the close of business on the Reference Date: (i) 480,131 Shares were issuable upon the exercise of outstanding Company Options; (ii) 254,238 Shares were subject to Company Restricted Stock Units; (iii) 150,545 Shares were reserved and available for issuance under the Company ESPP; and (iv) 3,090,908 Shares were issuable upon the exercise of outstanding Company Warrants.
~~~~

**Compact comparison shown**

~~~~text
Comparison point: Representation: Capitalisation securities
~~~~

**Expanded comparison shown**

~~~~text
Comparison point: Representation: Capitalisation securities
~~~~

**Ben's note, verbatim**

~~~~text
Missess which party
~~~~

**Required repair disposition**

Add subtype-required fields and source coverage. The repaired rule must expose every material condition, exception, scope, party and timing term identified by Ben.

### 8. INTERIM_OPERATING, SOURCE_TO_ROW

- Agreement: Red Hat / IBM
- Agreement ID: `06ec301641939fe0ac6e6ba598a33b40f16b1acc3ffb29109c7227b14bf1025a`
- Review item ID: `c288609df84fa942b08318d5fcbfe342e4ec2b3838967a829fb83e2aca241975`
- Failed row ID: `0b3d7d96f6cae964bac5b30ca465156d20f16473ebc854521f4c7403cae5650b`
- Section reference: `4.01`
- Ben's decision: `INCORRECT`
- Repair class: `MATERIAL_MEANING_OMITTED_OR_HIDDEN`

**Question shown to Ben**

> Does this comparison row preserve the important legal meaning of the source clause?

**Source excerpt**

~~~~text
(A) adopt, establish, enter into, terminate, materially amend or modify any material Benefit Plan or Benefit Agreement,
~~~~

**Compact comparison shown**

~~~~text
Comparison point: Interim operating restriction: Benefit plans
~~~~

**Expanded comparison shown**

~~~~text
Comparison point: Interim operating restriction: Benefit plans
Applies to: the Company
~~~~

**Ben's note, verbatim**

~~~~text
Misses materiality amend and material benefit plan qualifiers
~~~~

**Required repair disposition**

Add subtype-required fields and source coverage. The repaired rule must expose every material condition, exception, scope, party and timing term identified by Ben.

### 9. NO_SHOP, SOURCE_TO_ROW

- Agreement: Red Hat / IBM
- Agreement ID: `06ec301641939fe0ac6e6ba598a33b40f16b1acc3ffb29109c7227b14bf1025a`
- Review item ID: `4941a9e336ce2764395a9d4c78c4a00333684e22f08e32c0b0c07c972aa953fc`
- Failed row ID: `41ec46b9dd17846611dd7ce6f4c2f0d6358b2a66afb1a21854c7d5f62612eb9a`
- Section reference: `4.02`
- Ben's decision: `INCORRECT`
- Repair class: `MATERIAL_MEANING_OMITTED_OR_HIDDEN`

**Question shown to Ben**

> Does this comparison row preserve the important legal meaning of the source clause?

**Source excerpt**

~~~~text
(C) Parent does not make, within the applicable Superior Proposal Notice Period (or any extension or continuation thereof) after the receipt of such notice, a proposal that would, in the reasonable good faith judgment of the Company Board (after consultation with outside legal counsel and a financial advisor of national reputation), cause the offer previously constituting a Superior Proposal to no longer constitute a Superior Proposal (it being understood and agreed that any amendment or modification of such Superior Proposal shall require a new Superior Proposal Notice with a new Superior Proposal Notice Period of three (3) Business Days); and
~~~~

**Compact comparison shown**

~~~~text
Comparison point: No shop subsequent match period days
~~~~

**Expanded comparison shown**

~~~~text
Comparison point: No shop subsequent match period days
Applies to: the Company
Key facts: Day kind: Business days; Period role: Subsequent match; Unit phrase: Business Days
~~~~

**Ben's note, verbatim**

~~~~text
Why doesn't this specifiy the number of days (Which it has to inherit from "Superior Proposal Notice Period" and then also the 3 BD 2nd period for amendments?
~~~~

**Required repair disposition**

Add subtype-required fields and source coverage. The repaired rule must expose every material condition, exception, scope, party and timing term identified by Ben.

### 10. DNO_INDEMNIFICATION, SOURCE_TO_ROW

- Agreement: Red Hat / IBM
- Agreement ID: `06ec301641939fe0ac6e6ba598a33b40f16b1acc3ffb29109c7227b14bf1025a`
- Review item ID: `69bd9a055c55e764b4c27d5a1eda119bc7100251776dca3518ba2b42056560a7`
- Failed row ID: `119683c02a77c1fb822f7de78e0d3cf46061ae8d1a4e31c873a7360600f9a024`
- Section reference: Not recorded
- Ben's decision: `INCORRECT`
- Repair class: `MATERIAL_MEANING_OMITTED_OR_HIDDEN`

**Question shown to Ben**

> Does this comparison row preserve the important legal meaning of the source clause?

**Source excerpt**

~~~~text
Parent and Sub agree that all rights to indemnification, advancement of expenses and exculpation from liabilities for acts or omissions occurring at or prior to the Effective Time now existing in favor of the current or former directors or officers of the Company and its Subsidiaries as provided in their respective certificate of incorporation or bylaws (or comparable organizational documents) and any indemnification or other agreements of the Company as in effect on the date of this Agreement shall be assumed by the Surviving Corporation in the Merger, without further action, at the Effective Time, and shall survive the Merger and shall continue in full force and effect in accordance with their terms, and Parent shall cause the Surviving Corporation to comply with and honor the foregoing obligations.
~~~~

**Compact comparison shown**

~~~~text
Comparison point: Indemnification continuation
~~~~

**Expanded comparison shown**

~~~~text
Comparison point: Indemnification continuation
Applies to: Parent and Sub
~~~~

**Ben's note, verbatim**

~~~~text
misses WHAT indemnification obligations - i.e. " as provided in their respective certificate of incorporation or bylaws (or comparable organizational documents) and any indemnification or other agreements of the Company as in effect on the date of this Agreement"
~~~~

**Required repair disposition**

Add subtype-required fields and source coverage. The repaired rule must expose every material condition, exception, scope, party and timing term identified by Ben.

### 11. NO_OTHER_REPS_FRAUD, SOURCE_TO_ROW

- Agreement: Red Hat / IBM
- Agreement ID: `06ec301641939fe0ac6e6ba598a33b40f16b1acc3ffb29109c7227b14bf1025a`
- Review item ID: `94f1b28ee148d3c06da8c903e87610169fca0867a2fef0f1c82ec70f2731962b`
- Failed row ID: `191f8aba0ca0ab1a461633ebc8074c929c2eb51f92a1d491c216508e8aa5a4b4`
- Section reference: Not recorded
- Ben's decision: `CORRECT`
- Repair class: `CLEAN_CONTROL`

**Question shown to Ben**

> Does this comparison row preserve the important legal meaning of the source clause?

**Source excerpt**

~~~~text
Except for the representations and warranties expressly set forth in this Section 3.01, the Company Letter or in a certificate delivered pursuant to this Agreement, neither the Company nor any other person on behalf of the Company or its Subsidiaries makes any express or implied representation or warranty with respect to the Company or its Subsidiaries or with respect to any other information provided to Parent, Sub or any of their affiliates or representatives, including, but not limited to, its business, operations, assets, liabilities, conditions (financial or otherwise) or prospects, in connection with the transactions contemplated hereby.
~~~~

**Compact comparison shown**

~~~~text
Comparison point: No other representations disclaimer
~~~~

**Expanded comparison shown**

~~~~text
Comparison point: No other representations disclaimer
Applies to: Company
Key facts: Representation side: Target
~~~~

**Ben's note, verbatim**

~~~~text
None.
~~~~

**Required repair disposition**

Keep this source identity fixed and prove that the repair does not regress it.

### 12. ANTITRUST_REGULATORY, SOURCE_TO_ROW

- Agreement: Red Hat / IBM
- Agreement ID: `06ec301641939fe0ac6e6ba598a33b40f16b1acc3ffb29109c7227b14bf1025a`
- Review item ID: `ab57014997ba63110e5152739b4a0a87e42a52ab586be2ac960e83716a579d9d`
- Failed row ID: `10f3577f13b96818b28c2ef2c709a8e9c3f795ff67889c5f2d5a20e3c609b8ef`
- Section reference: `5.03`
- Ben's decision: `CORRECT`
- Repair class: `CLEAN_CONTROL`

**Question shown to Ben**

> Does this comparison row preserve the important legal meaning of the source clause?

**Source excerpt**

~~~~text
(B) where legally permissible, have the right to review in advance, and to the extent practicable each shall consult and consider in good faith the views of the other regarding, any material filing made with, or written materials to be submitted to, any Governmental Entity in connection with the transactions contemplated by this Agreement and of any material communication received or given in connection with any proceeding by a private person, in each case regarding any of the transactions contemplated by this agreement,
~~~~

**Compact comparison shown**

~~~~text
Comparison point: Regulatory consultation right
~~~~

**Expanded comparison shown**

~~~~text
Comparison point: Regulatory consultation right
Applies to: each
Key facts: Obligor party: each; Party with the right: the other
~~~~

**Ben's note, verbatim**

~~~~text
None.
~~~~

**Required repair disposition**

Keep this source identity fixed and prove that the repair does not regress it.

### 13. APPRAISAL_DISSENTERS_RIGHTS, SOURCE_TO_ROW

- Agreement: Skechers
- Agreement ID: `08fd217ea2561699fd43cb6c75ee26c358c018084956322c92e1e19d7ecce154`
- Review item ID: `fd930d7513c9e2f7d7215a736b33046671215cef02457a16ea7d69d535bb4829`
- Failed row ID: `25c3769517c928e4a5a6f35ccc5690a662a2fa0f165bbc6879cbe5acaa68065d`
- Section reference: `2.7`
- Ben's decision: `INCORRECT`
- Repair class: `MATERIAL_MEANING_OMITTED_OR_HIDDEN`

**Question shown to Ben**

> Does this comparison row preserve the important legal meaning of the source clause?

**Source excerpt**

~~~~text
The Company may not, except with the prior written consent of Parent, make any payment with respect to any demands for appraisal or settle or offer to settle, or approve the withdrawal of, any such demands or waive any failure to timely deliver a written demand for appraisal or otherwise to comply with Section 262 of the DGCL or agree to do any of the foregoing.
~~~~

**Compact comparison shown**

~~~~text
Comparison point: Appraisal settlement consent
~~~~

**Expanded comparison shown**

~~~~text
Comparison point: Appraisal settlement consent
~~~~

**Ben's note, verbatim**

~~~~text
Doesn't say which party needs whose consent.
~~~~

**Required repair disposition**

Add subtype-required fields and source coverage. The repaired rule must expose every material condition, exception, scope, party and timing term identified by Ben.

### 14. CAPITALISATION, REVIEW_ONLY_NO_NORMAL_ROW

- Agreement: AbbVie / Landos
- Agreement ID: `f4a123d7c2bd8ba6358499dd9870513c8bac6a6893985bf5a581a536af280d71`
- Review item ID: `84672cb087d864f42d4c7e9a86979c3f39fcf4a0c5fcfc9cbb0bcb607bdf32fd`
- Section reference: `3.3`
- Ben's decision: `INCORRECT`
- Repair class: `CLASSIFICATION_OR_SEMANTIC_DEPTH_FAILURE`

**Question shown to Ben**

> Is it correct to keep this item out of the normal comparison because an important fact is missing or unclear?

**Source excerpt**

~~~~text
The authorized capital stock of the Company consists of (i) 20,000,000 shares of Company Common Stock, of which 3,116,729 shares of Company Common Stock have been issued or are outstanding as of the close of business on March 22, 2024 (the “Reference Date”), (ii) 10,000,000 shares of Company Preferred Stock, none of which are issued or outstanding as of the close of business on the Reference Date.
~~~~

**Compact comparison shown**

~~~~text
None.
~~~~

**Expanded comparison shown**

~~~~text
None.
~~~~

**Ben's note, verbatim**

~~~~text
this is just a company cap rep
~~~~

**Required repair disposition**

Prove the correct family and subtype from the operative unit. Render the typed hierarchy and legal features instead of a broad label.

### 15. CONSIDERATION, SOURCE_TO_ROW

- Agreement: Red Hat / IBM
- Agreement ID: `06ec301641939fe0ac6e6ba598a33b40f16b1acc3ffb29109c7227b14bf1025a`
- Review item ID: `3583bd03b58d1d3c0474cee79d76afc8793b4335ad488cccdd624ff44acbc653`
- Failed row ID: `d7621437178f43499ace940f971082d59c90fe84736d0a2922057459f57ec1ba`
- Section reference: `2.01`
- Ben's decision: `CORRECT`
- Repair class: `SOURCE_ARTEFACT`

**Question shown to Ben**

> Does this comparison row preserve the important legal meaning of the source clause?

**Source excerpt**

~~~~text
Such Company Shareholders shall be entitled to receive payment of the appraised value of such Dissenting Shares to the extent afforded by Section 262 of the DGCL (in such case, the Dissenting Shares shall no longer be outstanding and shall automatically be canceled and cease to exist, and each holder of Dissenting
3
Shares shall cease to have any rights with regard thereto except with regard to such holders’ right to receive the fair value of such Dissenting Shares to the extent afforded by Section 262 of the DGCL); provided, however, that if, after the Effective Time, such holder fails to perfect, withdraws or otherwise loses such holder’s right to appraisal pursuant to Section 262 of the DGCL, or if a court of competent jurisdiction shall determine that such holder is not entitled to the relief provided by Section 262 of the DGCL, such shares of Company Common Stock shall be treated as if they had been converted as of the Effective Time into the right to receive the Merger Consideration in accordance with this Section 2.01, without interest thereon, upon surrender of such Certificate that formerly represented such shares of Company Common Stock in accordance with the terms of Section 2.02.
~~~~

**Compact comparison shown**

~~~~text
Comparison point: Appraisal rights status
~~~~

**Expanded comparison shown**

~~~~text
Comparison point: Appraisal rights status
Key facts: Appraisal status: Available
~~~~

**Ben's note, verbatim**

~~~~text
Correct but note you have a page number "3" in there
~~~~

**Required repair disposition**

Cover the page-number span with a governed `SOURCE_ARTEFACT` non-modelled disposition. Keep the sealed canonical bytes and every downstream offset unchanged. Exclude only that approved span from legal facts and display.

### 16. DIVIDENDS, SOURCE_TO_ROW

- Agreement: Concho
- Agreement ID: `1d6bba9ac993f72340d048742f995eb515a50cdfadb9bc86b3f36847baed9116`
- Review item ID: `abdb33252a3616ceade7552e4fd55f9d9ecee7f54590d0b7136b5952ec5eab76`
- Failed row ID: `62d5c580377039136ce829d2186e3fdf96580495ecf400f12aa25687b6330ab2`
- Section reference: `6.21`
- Ben's decision: `CORRECT`
- Repair class: `CLEAN_CONTROL`

**Question shown to Ben**

> Does this comparison row preserve the important legal meaning of the source clause?

**Source excerpt**

~~~~text
Parent and the Company shall each coordinate their record and payment dates for their regular quarterly dividends to ensure that the holders of Company Common Stock shall not receive two (2) dividends, or fail to receive one (1) dividend, in any quarter with respect to their Company Common Stock and the Parent Common Stock that such holders receive in exchange therefor in the Merger.
~~~~

**Compact comparison shown**

~~~~text
Comparison point: Dividend coordination covenant
~~~~

**Expanded comparison shown**

~~~~text
Comparison point: Dividend coordination covenant
Applies to: Parent and the Company
~~~~

**Ben's note, verbatim**

~~~~text
None.
~~~~

**Required repair disposition**

Keep this source identity fixed and prove that the repair does not regress it.

### 17. FINANCING_COVENANTS, SOURCE_TO_ROW

- Agreement: Skechers
- Agreement ID: `08fd217ea2561699fd43cb6c75ee26c358c018084956322c92e1e19d7ecce154`
- Review item ID: `c6152c1a17d5d08a112d795c1afe7a7f5ec2df48f06ec4e29f86ee7d6ad466d3`
- Failed row ID: `82bbf82c5144848b29570891605d4bca4cad965e94f7fe2e2797b2c5a942498a`
- Section reference: Not recorded
- Ben's decision: `CORRECT`
- Repair class: `CLEAN_CONTROL`

**Question shown to Ben**

> Does this comparison row preserve the important legal meaning of the source clause?

**Source excerpt**

~~~~text
Notwithstanding anything in this Agreement to the contrary, each of Parent and Merger Sub understands and acknowledges and agrees that obtaining the Financing is not a condition to the obligations of the parties to consummate the Merger in accordance with the terms and provisions of this Agreement.
~~~~

**Compact comparison shown**

~~~~text
Comparison point: Closing is not conditional on financing
~~~~

**Expanded comparison shown**

~~~~text
Comparison point: Closing is not conditional on financing
Key facts: Financing type: Not stated
~~~~

**Ben's note, verbatim**

~~~~text
None.
~~~~

**Required repair disposition**

Keep this source identity fixed and prove that the repair does not regress it.

### 18. GUARANTY_FINANCING_PARTY, SOURCE_TO_ROW

- Agreement: Skechers
- Agreement ID: `08fd217ea2561699fd43cb6c75ee26c358c018084956322c92e1e19d7ecce154`
- Review item ID: `ea2762b08aa05c92bf000e185708e56cd51b3418ccf955e917199bbf766c6f49`
- Failed row ID: `bbb33fe993f5d04ecca8267cf29f645c5621c04fe1b6d5f31ce4dd93b060843b`
- Section reference: Not recorded
- Ben's decision: `INCORRECT`
- Repair class: `MATERIAL_MEANING_OMITTED_OR_HIDDEN`

**Question shown to Ben**

> Does this comparison row preserve the important legal meaning of the source clause?

**Source excerpt**

~~~~text
Concurrently with the execution of this Agreement, Parent and Merger Sub have delivered a duly executed guaranty from 3G Fund VI, L.P., a Cayman Islands exempted limited partnership (“Guarantor”) to the Company.
~~~~

**Compact comparison shown**

~~~~text
Comparison point: Limited guaranty delivered
~~~~

**Expanded comparison shown**

~~~~text
Comparison point: Limited guaranty delivered
~~~~

**Ben's note, verbatim**

~~~~text
FRom who to who?
~~~~

**Required repair disposition**

Add subtype-required fields and source coverage. The repaired rule must expose every material condition, exception, scope, party and timing term identified by Ben.

### 19. MATERIAL_CONTRACTS, SOURCE_TO_ROW

- Agreement: Red Hat / IBM
- Agreement ID: `06ec301641939fe0ac6e6ba598a33b40f16b1acc3ffb29109c7227b14bf1025a`
- Review item ID: `6d7508599f3bc213d568d9afd80e434e6779f6c26c851930b5bafba5a64f4449`
- Failed row ID: `52135c876b4e8ce898a52c1874d3b727c433869e4d8f21ab24012589e3cc4c39`
- Section reference: `3.01(i)`
- Ben's decision: `INCORRECT`
- Repair class: `MATERIAL_MEANING_OMITTED_OR_HIDDEN`

**Question shown to Ben**

> Does this comparison row preserve the important legal meaning of the source clause?

**Source excerpt**

~~~~text
any Contract that (1) materially limits the right or ability of the Company, any of its Subsidiaries or any affiliate of any of them to compete with any other person in any line of business or geographic region that is material to the Company and its Subsidiaries, taken as a whole or (2) obligates the Company or its Subsidiaries (or following the Effective Time, Parent or its Subsidiaries) to conduct business with any third party on a preferential or exclusive basis or which contains “most favored nation” rights or similar rights, in each case, other than any such Contracts that are not material to the Company and its Subsidiaries, taken as a whole;
~~~~

**Compact comparison shown**

~~~~text
Comparison point: Material contract category: Noncompete
~~~~

**Expanded comparison shown**

~~~~text
Comparison point: Material contract category: Noncompete
Applies to: the Company
Key facts: Representing party: the Company
~~~~

**Ben's note, verbatim**

~~~~text
two issues - doesn't pickup "business or geographic region " and also doens't pickup the MFN

Also doens't pick up the "material to the Company and its Subsidiaries, taken as a whole;"
~~~~

**Required repair disposition**

Add subtype-required fields and source coverage. The repaired rule must expose every material condition, exception, scope, party and timing term identified by Ben.

### 20. MERGER_STRUCTURE_CLOSING, SOURCE_TO_ROW

- Agreement: Red Hat / IBM
- Agreement ID: `06ec301641939fe0ac6e6ba598a33b40f16b1acc3ffb29109c7227b14bf1025a`
- Review item ID: `3511a68df578c0c91aa76913c7a4ced396c1489ced251c6eabda04b9b39c8564`
- Failed row ID: `1094a0ff5f0028bc2b7e5cecb5986d6e13779c5b135817f7abf0002f8c74e960`
- Section reference: Not recorded
- Ben's decision: `INCORRECT`
- Repair class: `CLASSIFICATION_OR_SEMANTIC_DEPTH_FAILURE`

**Question shown to Ben**

> Does this comparison row preserve the important legal meaning of the source clause?

**Source excerpt**

~~~~text
At the Effective Time, the Company Bylaws shall be amended and restated in its entirety to be the bylaws of Sub as in effect immediately prior to the Effective Time, except that (i) all references therein to Sub shall be automatically amended and shall become references to the Surviving Corporation and (ii) changes necessary so that the bylaws shall be in compliance with Section 5.05 shall have been made, and such amended and restated bylaws shall become the bylaws of the Surviving Corporation until thereafter amended in accordance with the applicable provisions of the DGCL, the certificate of incorporation of the Surviving Corporation and such bylaws.
~~~~

**Compact comparison shown**

~~~~text
Comparison point: How the Effective Time is set
~~~~

**Expanded comparison shown**

~~~~text
Comparison point: How the Effective Time is set
~~~~

**Ben's note, verbatim**

~~~~text
No, this is a provision re: the Company Bylaws post closing
~~~~

**Required repair disposition**

Prove the correct family and subtype from the operative unit. Render the typed hierarchy and legal features instead of a broad label.

### 21. MISC_BOILERPLATE, SOURCE_TO_ROW

- Agreement: Skechers
- Agreement ID: `08fd217ea2561699fd43cb6c75ee26c358c018084956322c92e1e19d7ecce154`
- Review item ID: `d7809be9e3a6442021a7ebeb2c4ba4e7d59eed7943c5cf5d0a0250cf605c826a`
- Failed row ID: `078641a2fb0cb15775adc7ac71dec1580b7b5c2a50b5a4f8ea68d36e968ff063`
- Section reference: Not recorded
- Ben's decision: `CORRECT`
- Repair class: `CLEAN_CONTROL`

**Question shown to Ben**

> Does this comparison row preserve the important legal meaning of the source clause?

**Source excerpt**

~~~~text
Except as set forth in Section 6.10, this Section 9.6 and Section 9.15, the Parties agree that their respective representations, warranties and covenants set forth in this Agreement are solely for the benefit of the other Parties in accordance with and subject to the terms of this Agreement.
~~~~

**Compact comparison shown**

~~~~text
Comparison point: Third-party beneficiary exception
~~~~

**Expanded comparison shown**

~~~~text
Comparison point: Third-party beneficiary exception
~~~~

**Ben's note, verbatim**

~~~~text
None.
~~~~

**Required repair disposition**

Keep this source identity fixed and prove that the repair does not regress it.

### 22. PROXY_MEETING, SOURCE_TO_ROW

- Agreement: Red Hat / IBM
- Agreement ID: `06ec301641939fe0ac6e6ba598a33b40f16b1acc3ffb29109c7227b14bf1025a`
- Review item ID: `2e0f7ea75b7d9dadb83d1f5f6be8030bbf79ea3aa559f0adb3c13756fe539c23`
- Failed row ID: `50827ac01c6078d9a06adf61e7d5efa676138209f40e141d626e9459197e33bb`
- Section reference: `5.01`
- Ben's decision: `CORRECT`
- Repair class: `MATERIAL_MEANING_OMITTED_OR_HIDDEN`

**Question shown to Ben**

> Does this comparison row preserve the important legal meaning of the source clause?

**Source excerpt**

~~~~text
(iii) the Company Board has determined in good faith (after consultation with outside legal counsel) that such delay is required by applicable Law (A) to comply with comments made by the SEC with respect to the Proxy Statement or (B) to allow reasonable additional time for the filing or mailing of any supplemental or amended disclosure that the Company has determined, after consultation with outside legal counsel, is reasonably likely to be required under applicable Law and for such supplemental or amended disclosure to be disseminated and reviewed by stockholders of the Company prior to the Shareholder Meeting or
~~~~

**Compact comparison shown**

~~~~text
Comparison point: Reasons the meeting may be adjourned
~~~~

**Expanded comparison shown**

~~~~text
Comparison point: Reasons the meeting may be adjourned
Key facts: Obligated party: the Company; Reason: Supplemental disclosure; Reason: Legal requirement
~~~~

**Ben's note, verbatim**

~~~~text
Misses the test "that the Company has determined, after consultation with outside legal counsel, is reasonably likely to be required under applicable Law and for such supplemental or amended disclosure to be disseminated and reviewed by stockholders of the Company prior to the Shareholder Meeting"
~~~~

**Required repair disposition**

Add subtype-required fields and source coverage. The repaired rule must expose every material condition, exception, scope, party and timing term identified by Ben.

### 23. SPECIFIC_PERFORMANCE_REMEDIES, SOURCE_TO_ROW

- Agreement: Red Hat / IBM
- Agreement ID: `06ec301641939fe0ac6e6ba598a33b40f16b1acc3ffb29109c7227b14bf1025a`
- Review item ID: `0ac2d965af7d83f67e127081cead71efac42100e92224b0eec0b18c752f3e3a5`
- Failed row ID: `2bdac558d60ddd4f8ed1ca3e116fba4149e7e3c79517bebdcb87a3f3270b91c5`
- Section reference: Not recorded
- Ben's decision: `CORRECT`
- Repair class: `MATERIAL_MEANING_OMITTED_OR_HIDDEN`

**Question shown to Ben**

> Does this comparison row preserve the important legal meaning of the source clause?

**Source excerpt**

~~~~text
Section 8.11 Enforcement. The parties agree that irreparable damage would occur in the event that any of the provisions of this Agreement were not performed in accordance with their specific terms or were otherwise breached. It is accordingly agreed that the parties hereto shall be entitled to an injunction or injunctions to prevent breaches of this Agreement and to enforce specifically the terms and provisions of this Agreement in the Chosen Courts, this being in addition to any other remedy to which they are entitled at Law or in equity. The parties further agree not to assert that a remedy of specific enforcement is unenforceable, invalid, contrary to Law or inequitable for any reason, nor to assert that a remedy of monetary damages would provide an adequate remedy for any such breach. In the event any party hereto brings any action, claim, complaint, suit, action or other proceeding to enforce specifically the performance of the terms and provisions of this Agreement prior to the Closing, the Termination Date shall automatically be extended by (i) the amount of time during which such action, claim, complaint, suit, action or other proceeding is pending, plus twenty (20) Business Days, or (ii) such other time period established by the court presiding over such action, claim, complaint, suit, action or other proceeding. Notwithstanding anything to the contrary in this Agreement, none of the Financing Sources shall have any liability to the Company or any person that is an affiliate of the Company relating to or arising out of this Agreement or the Commitment Letter, whether at law, or equity, in contract, in tort or otherwise, and neither the Company nor any person that is an affiliate of the Company shall have any rights or claims against any Financing Sources hereunder or thereunder. As used in this Agreement, the term “Financing Sources” means any agent, arranger, Lender or other entity that has committed to provide or arrange, or has entered into definitive agreements related to, any debt financing related to the Merger, or any of such person’s affiliates or its or their respective officers, directors, employees, partners, trustees, shareholders, controlling persons, agents, representatives, successors or assigns.

~~~~

**Compact comparison shown**

~~~~text
Comparison point: Specific performance
~~~~

**Expanded comparison shown**

~~~~text
Comparison point: Specific performance
Applies to: The parties
~~~~

**Ben's note, verbatim**

~~~~text
Misses:

In the event any party hereto brings any action, claim, complaint, suit, action or other proceeding to enforce specifically the performance of the terms and provisions of this Agreement prior to the Closing, the Termination Date shall automatically be extended by (i) the amount of time during which such action, claim, complaint, suit, action or other proceeding is pending, plus twenty (20) Business Days, or (ii) such other time period established by the court presiding over such action, claim, complaint, suit, action or other proceeding.

AND

Notwithstanding anything to the contrary in this Agreement, none of the Financing Sources shall have any liability to the Company or any person that is an affiliate of the Company relating to or arising out of this Agreement or the Commitment Letter, whether at law, or equity, in contract, in tort or otherwise, and neither the Company nor any person that is an affiliate of the Company shall have any rights or claims against any Financing Sources hereunder or thereunder.
~~~~

**Required repair disposition**

Add subtype-required fields and source coverage. The repaired rule must expose every material condition, exception, scope, party and timing term identified by Ben.

### 24. TAX_MATTERS, SOURCE_TO_ROW

- Agreement: Skechers
- Agreement ID: `08fd217ea2561699fd43cb6c75ee26c358c018084956322c92e1e19d7ecce154`
- Review item ID: `20269feb5257fb4e0ece5dc115f716750af18b60dc4918dbc4938af3b950c970`
- Failed row ID: `0672078c7a1edc5ad57fd0db2425e8b3aabaf222350287be5ef404db4435b002`
- Section reference: `6.18`
- Ben's decision: `CORRECT`
- Repair class: `MATERIAL_MEANING_OMITTED_OR_HIDDEN`

**Question shown to Ben**

> Does this comparison row preserve the important legal meaning of the source clause?

**Source excerpt**

~~~~text
Neither Parent nor the Company shall, nor shall they permit their respective Subsidiaries to, take any action that would prevent or impede, or could reasonably be expected to prevent or impede, the Merger from qualifying for the Intended Tax Treatment; provided, however, the parties acknowledge and agree, that if the Merger fails to qualify for the Intended Tax Treatment solely as a result of a change in applicable law after the date of this Agreement, neither party shall be considered in breach of this Section 6.18(a) as a result of taking the actions after such change in applicable law contemplated by this Agreement; provided, further, that in the event of such change in applicable law, the parties shall reasonably cooperate to facilitate the transaction utilizing an alternative structure that leaves the Parent, Company and Company Stockholders in substantially the same economic and tax position had the Merger qualified for the Intended Tax Treatment.
~~~~

**Compact comparison shown**

~~~~text
Comparison point: Covenant to protect the intended tax treatment
~~~~

**Expanded comparison shown**

~~~~text
Comparison point: Covenant to protect the intended tax treatment
~~~~

**Ben's note, verbatim**

~~~~text
misses carve outs:

 provided, however, the parties acknowledge and agree, that if the Merger fails to qualify for the Intended Tax Treatment solely as a result of a change in applicable law after the date of this Agreement, neither party shall be considered in breach of this Section 6.18(a) as a result of taking the actions after such change in applicable law contemplated by this Agreement;
AND

provided, further, that in the event of such change in applicable law, the parties shall reasonably cooperate to facilitate the transaction utilizing an alternative structure that leaves the Parent, Company and Company Stockholders in substantially the same economic and tax position had the Merger qualified for the Intended Tax Treatment.
~~~~

**Required repair disposition**

Add subtype-required fields and source coverage. The repaired rule must expose every material condition, exception, scope, party and timing term identified by Ben.

### 25. TERMINATION_FEE, SOURCE_TO_ROW

- Agreement: Red Hat / IBM
- Agreement ID: `06ec301641939fe0ac6e6ba598a33b40f16b1acc3ffb29109c7227b14bf1025a`
- Review item ID: `c886e357665eb17974fce8861b9c9c5d4f7174363767ceb556c2cf6756dafddc`
- Failed row ID: `de8711732b1eb9e4d167d00fd1c8714ee5926160f17a89efe3eb07dd12aadb71`
- Section reference: `5.06`
- Ben's decision: `INCORRECT`
- Repair class: `MATERIAL_MEANING_OMITTED_OR_HIDDEN`

**Question shown to Ben**

> Does this comparison row preserve the important legal meaning of the source clause?

**Source excerpt**

~~~~text
this Agreement is terminated by the Company pursuant to Section 7.01(f), then, in each such case, the Company shall pay (or cause to be paid) to Parent a fee equal to $975,000,000 (the “Termination Fee”) by wire transfer of same-day funds
~~~~

**Compact comparison shown**

~~~~text
Comparison point: Termination fee amount
~~~~

**Expanded comparison shown**

~~~~text
Comparison point: Termination fee amount
Applies to: the Company
Key facts: Payer: the Company
~~~~

**Ben's note, verbatim**

~~~~text
doesn't pick up the termination limb trigger "Section 7.01(f)"
~~~~

**Required repair disposition**

Add subtype-required fields and source coverage. The repaired rule must expose every material condition, exception, scope, party and timing term identified by Ben.

### 26. REPRESENTATIONS, SOURCE_TO_ROW

- Agreement: Lilly / Verve
- Agreement ID: `fa0fff26622d0e90b47c3df527ccff91f4daa3db12f08d3832de76d8ae7541b5`
- Review item ID: `60b99d96752202a8ed7d49e8fa128eb578364735889cdcca5867b3937fbfdd18`
- Failed row ID: `053f46ecaca5546381f627bfde4b00a890963080f451df48a639ef21f02b44d4`
- Section reference: `ARTICLE IV`
- Ben's decision: `CORRECT`
- Repair class: `CLEAN_CONTROL`

**Question shown to Ben**

> Does this comparison row preserve the important legal meaning of the source clause?

**Source excerpt**

~~~~text
The Contemplated Transactions, in and of themselves, will not cause the revocation or cancellation of any Regulatory Authorization pursuant to the terms of any such Regulatory Authorization.
~~~~

**Compact comparison shown**

~~~~text
Comparison point: Representation: Compliance permits
~~~~

**Expanded comparison shown**

~~~~text
Comparison point: Representation: Compliance permits
~~~~

**Ben's note, verbatim**

~~~~text
None.
~~~~

**Required repair disposition**

Keep this source identity fixed and prove that the repair does not regress it.

### 27. REPRESENTATIONS, SOURCE_TO_ROW

- Agreement: Rocket / Redfin
- Agreement ID: `aa72f3af29316df52ab5cb75eb2b0bb0a5b31036bd24c7f812241c5a688f4319`
- Review item ID: `68e4937dd5fc508cab1ce17b2d3bff5ffdd3b1cb41bff87c9a26777bc3a24e4e`
- Failed row ID: `01f82f2cdf34c010c2b62bb7de129f3f025eb70760a38ff17e6b6ab2043f8352`
- Section reference: `2.4(b)`
- Ben's decision: `INCORRECT`
- Repair class: `CLASSIFICATION_OR_SEMANTIC_DEPTH_FAILURE`

**Question shown to Ben**

> Does this comparison row preserve the important legal meaning of the source clause?

**Source excerpt**

~~~~text
Except as would not, individually or in the aggregate, be material to the Company and its Subsidiaries, taken as a whole, the Company and its Subsidiaries have implemented and enforce a policy requiring each employee, consultant and contractor who has contributed or is expected to contribute to the creation or development of material Intellectual Property for or on behalf of the Company or any of its Subsidiaries to execute a written assignment of rights to the Company or one of its Subsidiaries that conveys to the Company or one or more of its Subsidiaries any and all right, title and interest in and to all Intellectual Property developed by such Person in connection with such Person’s employment or engagement by the Company or one or more of its Subsidiaries.
~~~~

**Compact comparison shown**

~~~~text
Comparison point: Representation: Employment benefits [1 linked point in full row]
~~~~

**Expanded comparison shown**

~~~~text
Comparison point: Representation: Employment benefits
Comparison point: Representation: Intellectual property
~~~~

**Ben's note, verbatim**

~~~~text
not employee benefits - it's really IP

And the comparison point is IP ASsignment agreemnets

Misses "f material Intellectual Property" and "Except as would not, individually or in the aggregate, be material to the " qualifiers
~~~~

**Required repair disposition**

Prove the correct family and subtype from the operative unit. Render the typed hierarchy and legal features instead of a broad label.

### 28. DNO_INDEMNIFICATION, SOURCE_TO_ROW

- Agreement: Modiv
- Agreement ID: `fb76ef57355bef7f05b3b8955f5f7da4f430964923fecce0c95156c6e0b04a5c`
- Review item ID: `a252ced9e30de188b3cba76f5ac2992509ec2b16fea032526286521b0ead8c32`
- Failed row ID: `0694ad92443739cc84776ae7fe087c3993f9b01c0a24b754ec4d5612ed286139`
- Section reference: Not recorded
- Ben's decision: `INCORRECT`
- Repair class: `MATERIAL_MEANING_OMITTED_OR_HIDDEN`

**Question shown to Ben**

> Does this comparison row preserve the important legal meaning of the source clause?

**Source excerpt**

~~~~text
For a period of not less than six (6) years from the OpCo Merger Effective Time, the Surviving Company and the Surviving OpCo shall provide to the Indemnified Parties the same rights to exculpation, indemnification and advancement of expenses as provided to the Indemnified Parties under the provisions of the Company’s and the Company Subsidiaries’ charter, bylaws or similar organizational documents or as provided in indemnification agreements or other agreements of the Company or any of the Company Subsidiaries, in all cases, as in effect as of the date hereof and the Surviving Company’s, the Surviving OpCo’s and any applicable Company Subsidiaries’ charter, bylaws or similar organizational documents shall contain provisions no less favorable than such rights, which provisions shall not be amended, repealed or modified for a period of six (6) years following the OpCo Merger Effective Time in any manner that would affect adversely the rights thereunder of the Indemnified Parties.
~~~~

**Compact comparison shown**

~~~~text
Comparison point: Charter protection continuation [1 linked point in full row]
~~~~

**Expanded comparison shown**

~~~~text
Comparison point: Charter protection continuation
Comparison point: Advancement of expenses
~~~~

**Ben's note, verbatim**

~~~~text
No. isn't just advancement.  Is also "exculpation, indemnification " also limited to "s provided to the Indemnified Parties under the provisions of the Company’s and the Company Subsidiaries’ charter, bylaws or similar organizational documents or as provided in indemnification agreements or other agreements of the Company or any of the Company Subsidiaries, in all cases, as in effect as of the date hereof"

Also misses the obligaiotn to keep "he Surviving Company’s, the Surviving OpCo’s and any applicable Company Subsidiaries’ charter, bylaws or similar organizational documents shall contain provisions no less favorable than such rights"

And how long those must be kepy in place for "or a period of six (6) years following the OpCo Merger Effective Time "
~~~~

**Required repair disposition**

Add subtype-required fields and source coverage. The repaired rule must expose every material condition, exception, scope, party and timing term identified by Ben.

### 29. MAE_DEFINITION, SOURCE_TO_ROW

- Agreement: Metsera
- Agreement ID: `f783c4cdcaca4626c695d1c2c67924ccd8867eb066e16f17407ca64497ba778c`
- Review item ID: `414b08d74d441e522bd2faa3676fb55fe2e6f73d314aeb0e282dc561ce8c27f7`
- Failed row ID: `cd85b73d38f97a9a2c4e3dbe74ab45f54dcf0524d510fb3573b2cf2a61a75af6`
- Section reference: `9.03`
- Ben's decision: `CORRECT`
- Repair class: `CLEAN_CONTROL`

**Question shown to Ben**

> Does this comparison row preserve the important legal meaning of the source clause?

**Source excerpt**

~~~~text
(ii) would or would reasonably be expected to prevent the consummation of, or materially impair the ability of the Company to consummate, the Merger by the Outside Date;
~~~~

**Compact comparison shown**

~~~~text
Comparison point: MAE definition prong
~~~~

**Expanded comparison shown**

~~~~text
Comparison point: MAE definition prong
Applies to: the Company
Key facts: Defined party: the Company; MAE prong: Consummation prevention
~~~~

**Ben's note, verbatim**

~~~~text
None.
~~~~

**Required repair disposition**

Keep this source identity fixed and prove that the repair does not regress it.

### 30. NO_OTHER_REPS_FRAUD, SOURCE_TO_ROW

- Agreement: SkyWater
- Agreement ID: `b74ed1f02f2e1385121b187cb0bb6dd8144ff18449149b6cf20182eede0eb363`
- Review item ID: `f80724f3a2d44671b4dd47f60ced55977e77e910f9c9c47e85ebf5342c014c77`
- Failed row ID: `0f3046e82c89ed77c6e239d1139e488c82832fad32121e4f6b72a52bc810a539`
- Section reference: Not recorded
- Ben's decision: `CORRECT`
- Repair class: `CLEAN_CONTROL`

**Question shown to Ben**

> Does this comparison row preserve the important legal meaning of the source clause?

**Source excerpt**

~~~~text
Except for the representations and warranties made in this Article III (as qualified by the Company Disclosure Schedules), the Voting Agreement or any certificate delivered pursuant to this Agreement, neither the Company nor any other Person makes any express or implied representation or warranty with respect to the Company or its Subsidiaries or their respective businesses, operations, assets, liabilities or conditions (financial or otherwise) in connection with this Agreement, the Mergers or the other Transactions, and the Company hereby disclaims any such other representations or warranties.
~~~~

**Compact comparison shown**

~~~~text
Comparison point: No other representations disclaimer
~~~~

**Expanded comparison shown**

~~~~text
Comparison point: No other representations disclaimer
Applies to: Company
Key facts: Representation side: Target
~~~~

**Ben's note, verbatim**

~~~~text
None.
~~~~

**Required repair disposition**

Keep this source identity fixed and prove that the repair does not regress it.

### 31. NO_SHOP, SOURCE_TO_ROW

- Agreement: Concho
- Agreement ID: `1d6bba9ac993f72340d048742f995eb515a50cdfadb9bc86b3f36847baed9116`
- Review item ID: `2c084fc29a21c1d0353252b368d1b63c80cb92a5b6cbfc9b1ce89b2b6f3abd68`
- Failed row ID: `b732448251edba32678cf3129cd7d267721c452e62384b6c9a82900974855adf`
- Section reference: `6.4`
- Ben's decision: `INCORRECT`
- Repair class: `MATERIAL_MEANING_OMITTED_OR_HIDDEN`

**Question shown to Ben**

> Does this comparison row preserve the important legal meaning of the source clause?

**Source excerpt**

~~~~text
the Parent Board may, after consultation with its outside legal counsel, make such disclosures as the Parent Board determines in good faith are necessary to comply with Rule 14d-9 or Rule 14e-2(a) promulgated under the Exchange Act or other disclosure required to be made in the Joint Proxy Statement by applicable U.S. federal securities laws; provided, however, that if such disclosure has the effect of withdrawing or adversely modifying the Parent Board Recommendation, such disclosure shall be deemed to be a Parent Change of Recommendation and the Company shall have the right to terminate this Agreement as set forth in Section 8.1(c);
~~~~

**Compact comparison shown**

~~~~text
Comparison point: Disclosure that does not change the board recommendation
~~~~

**Expanded comparison shown**

~~~~text
Comparison point: Disclosure that does not change the board recommendation
Applies to: the Parent Board
Key facts: Covenant obligor: the Parent Board
~~~~

**Ben's note, verbatim**

~~~~text
misses the requirement "re necessary to comply with Rule 14d-9 or Rule 14e-2(a) promulgated under the Exchange Act or other disclosure required to be made in the Joint Proxy Statement by applicable U.S. federal securities laws"

And also the proviso " provided, however, that if such disclosure has the effect of withdrawing or adversely modifying the Parent Board Recommendation, such disclosure shall be deemed to be a Parent Change of Recommendation and the Company shall have the right to terminate this Agreement as set forth in Section 8.1(c);"

And also the ", after consultation with its outside legal counsel, "
~~~~

**Required repair disposition**

Add subtype-required fields and source coverage. The repaired rule must expose every material condition, exception, scope, party and timing term identified by Ben.

### 32. KEY_DEFINED_TERMS, SOURCE_TO_ROW

- Agreement: Red Hat / IBM
- Agreement ID: `06ec301641939fe0ac6e6ba598a33b40f16b1acc3ffb29109c7227b14bf1025a`
- Review item ID: `b0bcdcdf317cae10956b09f999502a6ff0bb2e75625896a60ce9489c322d2cf7`
- Failed row ID: `e074ef05a5c1cfee04128139695403d98c9f4d50f8a6d5c61713c55443fa31a5`
- Section reference: `8.03`
- Ben's decision: `CORRECT`
- Repair class: `CLEAN_CONTROL`

**Question shown to Ben**

> Does this comparison row preserve the important legal meaning of the source clause?

**Source excerpt**

~~~~text
“knowledge” means, with respect to any matter in question, the actual knowledge of the persons identified in Section 8.03(k) of the Company Letter;
~~~~

**Compact comparison shown**

~~~~text
Comparison point: Knowledge person source [1 linked point in full row]
~~~~

**Expanded comparison shown**

~~~~text
Comparison point: Knowledge person source
Comparison point: Knowledge standard
Key facts: Defined term identity: knowledge; Whose knowledge: Target; Definition wording: the persons identified in Section 8.03(k) of the Company Letter; Definition wording: the actual knowledge; Standard: Actual
~~~~

**Ben's note, verbatim**

~~~~text
None.
~~~~

**Required repair disposition**

Keep this source identity fixed and prove that the repair does not regress it.

### 33. MAE_DEFINITION, SOURCE_TO_ROW

- Agreement: Red Hat / IBM
- Agreement ID: `06ec301641939fe0ac6e6ba598a33b40f16b1acc3ffb29109c7227b14bf1025a`
- Review item ID: `d7998df46cd00ec8d3c620608bc1a7d2db975d41cd22ea98d82dec5bfd95e513`
- Failed row ID: `9e6a56aa4bd2d01db734ce9b9ad7a0df11a4a1d447f6bf7e9b7d701ea97adc79`
- Section reference: `8.03(l)`
- Ben's decision: `INCORRECT`
- Repair class: `CLASSIFICATION_OR_SEMANTIC_DEPTH_FAILURE`

**Question shown to Ben**

> Does this comparison row preserve the important legal meaning of the source clause?

**Source excerpt**

~~~~text
(B) any change in GAAP or applicable Law that does not disproportionately affect the Company and its Subsidiaries, taken as a whole, relative to other participants of a similar size in its industry, in which case only the incremental disproportionate effect shall be taken into account;
~~~~

**Compact comparison shown**

~~~~text
Comparison point: MAE disproportionality carveback [1 linked point in full row]
~~~~

**Expanded comparison shown**

~~~~text
Comparison point: MAE disproportionality carveback
Comparison point: MAE carveout
Applies to: the Company and its Subsidiaries
Key facts: Applies to: (B); Compared with: relative to other participants of a similar size in its industry; Defined party: the Company and its Subsidiaries; Effect counted: only the incremental disproportionate effect shall be taken into account; Carve-out: Change in GAAP
~~~~

**Ben's note, verbatim**

~~~~text
So maybe I'm just dumb but I don't like the "comparison entry corpus would store layout" for this one it should say

Party Applies to: Company and its Subs
Provision Type: MAE Definition
Sub-Provision Type: MAE Carveout
Sub-Sub-Provision Type: Change in Law
Notes: In cludes GAAP and Law. Does not expressly include interpretations.
Notes: relative to other participants of a similar size in its industry,
Disproportionate Effect Exception: Yes

Obviously my nomenclature is off but that's way clearer thatn your word salad - applies to all ofthe other cards too
~~~~

**Required repair disposition**

Prove the correct family and subtype from the operative unit. Render the typed hierarchy and legal features instead of a broad label.

### 34. MAE_DEFINITION, SOURCE_TO_ROW

- Agreement: Red Hat / IBM
- Agreement ID: `06ec301641939fe0ac6e6ba598a33b40f16b1acc3ffb29109c7227b14bf1025a`
- Review item ID: `6b1781efda5e8c235f51f7bd7ef4f7ddda24e7c5ea34913e866f7417bee8598f`
- Failed row ID: `cb9099cd0d8b4e05e53627a6ece86fef4342ca857ce0770ab8a4f41c8881aadc`
- Section reference: `8.03(l)`
- Ben's decision: `INCORRECT`
- Repair class: `MATERIAL_MEANING_OMITTED_OR_HIDDEN`

**Question shown to Ben**

> Does this comparison row preserve the important legal meaning of the source clause?

**Source excerpt**

~~~~text
(C) any act of terrorism, war (whether or not declared), national disaster, cyber-attack or any national or international calamity affecting the United States or any other country or region of the world that does not disproportionately affect the Company and its Subsidiaries, taken as a whole, relative to other participants of a similar size in its industry, in which case only the incremental disproportionate effect shall be taken into account;
~~~~

**Compact comparison shown**

~~~~text
Comparison point: MAE carveout [1 linked point in full row]
~~~~

**Expanded comparison shown**

~~~~text
Comparison point: MAE carveout
Comparison point: MAE disproportionality carveback
Applies to: the Company and its Subsidiaries
Key facts: Carve-out: War or terrorism; Defined party: the Company and its Subsidiaries; Applies to: (C); Compared with: relative to other participants of a similar size in its industry; Effect counted: only the incremental disproportionate effect shall be taken into account
~~~~

**Ben's note, verbatim**

~~~~text
See prior note, generally ok but I'd get into the words more here as sub types "any act of terrorism, war (whether or not declared), national disaster, cyber-attack or any national or international calamity "
~~~~

**Required repair disposition**

Add subtype-required fields and source coverage. The repaired rule must expose every material condition, exception, scope, party and timing term identified by Ben.

### 35. MAE_DEFINITION, SOURCE_TO_ROW

- Agreement: Red Hat / IBM
- Agreement ID: `06ec301641939fe0ac6e6ba598a33b40f16b1acc3ffb29109c7227b14bf1025a`
- Review item ID: `580bcd3868d1a160dd491872f10df6f4cf55bcbba6b311def46789ed73d9558d`
- Failed row ID: `ea04e70618b9a98b6c24befcecfdf7ce87765dd30ac27f61b7afd0156fd50cbf`
- Section reference: `8.03(l)`
- Ben's decision: `CORRECT`
- Repair class: `MATERIAL_MEANING_OMITTED_OR_HIDDEN`

**Question shown to Ben**

> Does this comparison row preserve the important legal meaning of the source clause?

**Source excerpt**

~~~~text
(A) any change in general economic, market or political conditions affecting the United States economy, or any other national or regional economy or the global economy generally that does not disproportionately affect the Company and its Subsidiaries, taken as a whole, relative to other participants of a similar size in its industry, in which case only the incremental disproportionate effect shall be taken into account;
~~~~

**Compact comparison shown**

~~~~text
Comparison point: MAE disproportionality carveback [1 linked point in full row]
~~~~

**Expanded comparison shown**

~~~~text
Comparison point: MAE disproportionality carveback
Comparison point: MAE carveout
Applies to: the Company and its Subsidiaries
Key facts: Applies to: (A); Compared with: relative to other participants of a similar size in its industry; Defined party: the Company and its Subsidiaries; Effect counted: only the incremental disproportionate effect shall be taken into account; Carve-out: General economic conditions
~~~~

**Ben's note, verbatim**

~~~~text
Same as prior one
~~~~

**Required repair disposition**

Add subtype-required fields and source coverage. The repaired rule must expose every material condition, exception, scope, party and timing term identified by Ben.

### 36. MAE_DEFINITION, SOURCE_TO_ROW

- Agreement: Red Hat / IBM
- Agreement ID: `06ec301641939fe0ac6e6ba598a33b40f16b1acc3ffb29109c7227b14bf1025a`
- Review item ID: `4d551d4c0598026cb65546a59f619002d837df58bd679b2154a744306096a3e7`
- Failed row ID: `f1771dcb2e9f52276a9c647c96b8c7c13291394bee203c34016ff6927d03478f`
- Section reference: `8.03(l)`
- Ben's decision: `INCORRECT`
- Repair class: `MATERIAL_MEANING_OMITTED_OR_HIDDEN`

**Question shown to Ben**

> Does this comparison row preserve the important legal meaning of the source clause?

**Source excerpt**

~~~~text
(D) changes in the financial, credit, banking or securities markets in the United States or any other country or region in the world (including any disruption thereof and any decline in the price of any security or any market index) and including changes or developments in or relating to currency exchange or interest rates that does not disproportionately affect the Company and its Subsidiaries, taken as a whole, relative to other participants of a similar size in its industry, in which case only the incremental disproportionate effect shall be taken into account;
~~~~

**Compact comparison shown**

~~~~text
Comparison point: MAE disproportionality carveback [1 linked point in full row]
~~~~

**Expanded comparison shown**

~~~~text
Comparison point: MAE disproportionality carveback
Comparison point: MAE carveout
Applies to: the Company and its Subsidiaries
Key facts: Applies to: (D); Compared with: relative to other participants of a similar size in its industry; Defined party: the Company and its Subsidiaries; Effect counted: only the incremental disproportionate effect shall be taken into account; Carve-out: Financial markets
~~~~

**Ben's note, verbatim**

~~~~text
would also pick up. and including changes or developments in or relating to currency exchange or interest rates that
~~~~

**Required repair disposition**

Add subtype-required fields and source coverage. The repaired rule must expose every material condition, exception, scope, party and timing term identified by Ben.

### 37. MATERIAL_CONTRACTS, SOURCE_TO_ROW

- Agreement: Red Hat / IBM
- Agreement ID: `06ec301641939fe0ac6e6ba598a33b40f16b1acc3ffb29109c7227b14bf1025a`
- Review item ID: `ec82070a126144f90b83d780bb6d1130b3f6fef1994f5d6774e7c469b101f0a1`
- Failed row ID: `5ef42bf72dc66e6fc29b896c833c3f8830a046dd427d7e7933b29dfcef691eae`
- Section reference: `3.01(i)`
- Ben's decision: `CORRECT`
- Repair class: `CLEAN_CONTROL`

**Question shown to Ben**

> Does this comparison row preserve the important legal meaning of the source clause?

**Source excerpt**

~~~~text
any Contract relating to Indebtedness of the Company or any of its Subsidiaries having an outstanding principal amount in excess of $50,000,000 other than
~~~~

**Compact comparison shown**

~~~~text
Comparison point: Material contract category: Indebtedness
~~~~

**Expanded comparison shown**

~~~~text
Comparison point: Material contract category: Indebtedness
Applies to: the Company
Key facts: Representing party: the Company; Threshold: $50,000,000
~~~~

**Ben's note, verbatim**

~~~~text
None.
~~~~

**Required repair disposition**

Keep this source identity fixed and prove that the repair does not regress it.

### 38. ANTITRUST_REGULATORY, REVIEW_ONLY_NO_NORMAL_ROW

- Agreement: AbbVie / Landos
- Agreement ID: `f4a123d7c2bd8ba6358499dd9870513c8bac6a6893985bf5a581a536af280d71`
- Review item ID: `dddd7d951189463c51b4be52fbfb7897015537318a06c9f969e2e9b85c9feda4`
- Section reference: `5.5`
- Ben's decision: `INCORRECT`
- Repair class: `CLASSIFICATION_OR_SEMANTIC_DEPTH_FAILURE`

**Question shown to Ben**

> Is it correct to keep this item out of the normal comparison because an important fact is missing or unclear?

**Source excerpt**

~~~~text
Subject to the terms and conditions set forth in this Agreement, each of the Parties shall, and shall cause their respective Affiliates to, use their respective reasonable best efforts to take, or cause to be taken, all actions, to file, or cause to be filed, all documents, and to do, or cause to be done, and to assist and cooperate with the other Parties in doing, all things necessary, proper, or advisable under applicable Antitrust Laws or Foreign Direct Investment Laws to consummate and make effective the Transactions as soon as reasonably practicable, including, (i) the obtaining of all necessary actions or nonactions, waivers, consents, clearances, decisions, declarations, approvals and, expirations, or terminations of waiting periods from Governmental Bodies and the making of all necessary registrations and filings and the taking of all steps as may be reasonably necessary to obtain any such consent, decision, declaration, approval, clearance, or waiver, or expiration or termination of a waiting period by or from, or to avoid a Legal Proceeding by, any Governmental Body in connection with any Antitrust Law or Foreign Direct Investment Law, (ii) the giving of all notices and the obtaining of all necessary consents, authorizations, approvals, or waivers from third parties, and (iii) the execution and delivery of any additional instrument reasonably necessary to consummate the Transactions.
~~~~

**Compact comparison shown**

~~~~text
None.
~~~~

**Expanded comparison shown**

~~~~text
None.
~~~~

**Ben's note, verbatim**

~~~~text
This is the general antitrust covenant - applies to both parties at reasonable best effort
~~~~

**Required repair disposition**

Prove the correct family and subtype from the operative unit. Render the typed hierarchy and legal features instead of a broad label.

### 39. PARSER, PARSER_AMBIGUITY

- Agreement: Red Hat / IBM
- Agreement ID: `06ec301641939fe0ac6e6ba598a33b40f16b1acc3ffb29109c7227b14bf1025a`
- Review item ID: `de6a5cf2b17e1d717463f5f2a59622d8136d457a2d6c4e9f2f664152e2581535`
- Section reference: Not recorded
- Ben's decision: `INCORRECT`
- Repair class: `FALSE_PARSER_AMBIGUITY`

**Question shown to Ben**

> Is it correct to flag this source structure and block only a comparison item that depends on the unclear wording?

**Source excerpt**

~~~~text
(i) would give rise to the failure of a condition set forth in Section 6.02(a) or Section 6.02(b) and (ii) (A) is incapable of being cured prior to the Termination Date or (B) is not cured by the Company on or before the earlier of (i) the Termination Date and (ii)
~~~~

**Compact comparison shown**

~~~~text
None.
~~~~

**Expanded comparison shown**

~~~~text
None.
~~~~

**Ben's note, verbatim**

~~~~text
this is a nesting number issues - there is a (i) inside of (B) which I assume you are rejecting because it is two (i) levels within a numbering system -it happens
~~~~

**Required repair disposition**

Apply the governed M5 parent-scoping overlay to this exact ambiguity. Keep the M2 parser, bytes and ambiguity record unchanged.

### 40. CLOSING_CONDITIONS, REVIEW_ONLY_NO_NORMAL_ROW

- Agreement: AbbVie / Landos
- Agreement ID: `f4a123d7c2bd8ba6358499dd9870513c8bac6a6893985bf5a581a536af280d71`
- Review item ID: `a0968db9f4526d55f0d8dd547ef50387b8bbb046a3e1260e6524eaf4cd77332e`
- Section reference: `6.1`
- Ben's decision: `INCORRECT`
- Repair class: `CLASSIFICATION_OR_SEMANTIC_DEPTH_FAILURE`

**Question shown to Ben**

> Is it correct to keep this item out of the normal comparison because an important fact is missing or unclear?

**Source excerpt**

~~~~text
The Required Company Stockholder Vote shall have been obtained.
~~~~

**Compact comparison shown**

~~~~text
None.
~~~~

**Expanded comparison shown**

~~~~text
None.
~~~~

**Ben's note, verbatim**

~~~~text
This is a very simple one...shareholder vote condition?
~~~~

**Required repair disposition**

Prove the correct family and subtype from the operative unit. Render the typed hierarchy and legal features instead of a broad label.

### 41. CONSIDERATION, REVIEW_ONLY_NO_NORMAL_ROW

- Agreement: AbbVie / Landos
- Agreement ID: `f4a123d7c2bd8ba6358499dd9870513c8bac6a6893985bf5a581a536af280d71`
- Review item ID: `ed8c6986fb2293939a13942beae50f3e45107c760d6656bb7d7370037a2a979f`
- Section reference: `2.2`
- Ben's decision: `INCORRECT`
- Repair class: `APPROVED_NO_COMPARISON`

**Question shown to Ben**

> Is it correct to keep this item out of the normal comparison because an important fact is missing or unclear?

**Source excerpt**

~~~~text
As soon as reasonably practicable after the Effective Time and in any event not later than the third (3rd) business day following the Closing Date, Parent shall cause the Paying Agent to mail to each holder of record of Shares whose Shares were Certificated and converted into the right to receive Merger Consideration pursuant to Section 2.1(a), (A) a letter of transmittal (which shall specify that delivery shall be effected, and risk of loss and title to Certificates shall pass, only upon delivery of Certificates (or effective affidavits of loss in lieu thereof) to the Paying Agent and shall be in such form and have such other provisions as Parent and the Company may mutually reasonably agree) and (B) instructions for use in effecting the surrender of Certificates (or effective affidavits of loss in lieu thereof) in exchange for Merger Consideration.
~~~~

**Compact comparison shown**

~~~~text
None.
~~~~

**Expanded comparison shown**

~~~~text
None.
~~~~

**Ben's note, verbatim**

~~~~text
this is just a mechanics proviison - no need for comparions
~~~~

**Required repair disposition**

Record an approved administrative-mechanics no-comparison disposition. Do not create a normal or vague review row.

### 42. DNO_INDEMNIFICATION, REVIEW_ONLY_NO_NORMAL_ROW

- Agreement: AbbVie / Landos
- Agreement ID: `f4a123d7c2bd8ba6358499dd9870513c8bac6a6893985bf5a581a536af280d71`
- Review item ID: `f70963f0b88cb7c98e766fcb06089e307503525119808032591326fc1765078a`
- Section reference: `5.7`
- Ben's decision: `INCORRECT`
- Repair class: `CLASSIFICATION_OR_SEMANTIC_DEPTH_FAILURE`

**Question shown to Ben**

> Is it correct to keep this item out of the normal comparison because an important fact is missing or unclear?

**Source excerpt**

~~~~text
All rights to indemnification, advancement of expenses, and exculpation by the Company existing (the “Indemnification Obligations”) in favor of those Persons who are directors or officers of the Company as of the date of this Agreement or have been directors or officers of the Company in the past (collectively, the “Indemnified Persons”) for their acts and omissions occurring prior to the Effective Time, as provided in the Organizational Documents of the Company (as in effect as of the date of this Agreement) or in any indemnification agreements between the Company and said Indemnified Persons that was made available to Parent (as in effect as of the date of this Agreement) shall survive the Effective Time and shall not be amended, repealed, or otherwise modified in any manner that would adversely affect the rights thereunder of any Indemnified Person, and shall be observed and maintained by the Surviving Corporation and its Subsidiaries to the fullest extent available under applicable Law for a period of six (6) years from the Effective Time, and any claim made pursuant to such rights within such six-year period shall continue to be subject to this Section 5.7(a) and the rights provided under this Section 5.7(a) until disposition of such claim.
~~~~

**Compact comparison shown**

~~~~text
None.
~~~~

**Expanded comparison shown**

~~~~text
None.
~~~~

**Ben's note, verbatim**

~~~~text
indemnficiaiton -see arlier ansewr
~~~~

**Required repair disposition**

Prove the correct family and subtype from the operative unit. Render the typed hierarchy and legal features instead of a broad label.

### 43. EMPLOYEE_MATTERS, REVIEW_ONLY_NO_NORMAL_ROW

- Agreement: AbbVie / Landos
- Agreement ID: `f4a123d7c2bd8ba6358499dd9870513c8bac6a6893985bf5a581a536af280d71`
- Review item ID: `9bf69d6bdbe2e84855a1c8afabe90b8b1f019a8286e79354d031f27535c74fd2`
- Section reference: `3.20`
- Ben's decision: `INCORRECT`
- Repair class: `CLASSIFICATION_OR_SEMANTIC_DEPTH_FAILURE`

**Question shown to Ben**

> Is it correct to keep this item out of the normal comparison because an important fact is missing or unclear?

**Source excerpt**

~~~~text
Neither the Company nor any other Person that would be or, at any relevant time, would have been considered a single employer with the Company under the Code or ERISA has during the six (6) years prior to the date of this Agreement maintained, contributed to or been required to contribute to (i) a plan subject to Title IV of ERISA or Code Section 412, including any “single employer” defined benefit plan or any “multiemployer plan,” each within the meaning of Section 4001 of ERISA, (ii) a “multiple employer plan” within the meaning of Section 413(c) of the Code, or (iii) a “multiple employer welfare arrangement” within the meaning of Section 3(40) of ERISA.
~~~~

**Compact comparison shown**

~~~~text
None.
~~~~

**Expanded comparison shown**

~~~~text
None.
~~~~

**Ben's note, verbatim**

~~~~text
ERISA rep
From company
6 year look back
~~~~

**Required repair disposition**

Prove the correct family and subtype from the operative unit. Render the typed hierarchy and legal features instead of a broad label.

### 44. GENERAL_COVENANTS, REVIEW_ONLY_NO_NORMAL_ROW

- Agreement: AbbVie / Landos
- Agreement ID: `f4a123d7c2bd8ba6358499dd9870513c8bac6a6893985bf5a581a536af280d71`
- Review item ID: `93007a95ffd285947ae75b45f08c707ba24d93d0c60422f437eadf9c0e8a1b17`
- Section reference: `5.1`
- Ben's decision: `INCORRECT`
- Repair class: `MATERIAL_MEANING_OMITTED_OR_HIDDEN`

**Question shown to Ben**

> Is it correct to keep this item out of the normal comparison because an important fact is missing or unclear?

**Source excerpt**

~~~~text
Subject to applicable Law, during the period from the date of this Agreement until the earlier of the Effective Time and the termination of this Agreement in accordance with Section 7.1 (the “Pre-Closing Period”), on reasonable advance notice to the Company, the Company shall, and shall cause its Subsidiaries to, provide Parent and its Representatives with reasonable access during the Company’s normal business hours to the Company and its Subsidiaries, personnel, and books and records reasonably requested by Parent for purposes of strategic and integration planning for the consummation of the Transactions; provided that any such access shall be conducted at a reasonable time and in such a manner as not to unreasonably interfere with the normal operation of the business of the Company.
~~~~

**Compact comparison shown**

~~~~text
None.
~~~~

**Expanded comparison shown**

~~~~text
None.
~~~~

**Ben's note, verbatim**

~~~~text
This is an access covenant, as I have taiught you before - we have to track the scope of what they can get access to "o the Company and its Subsidiaries, personnel, and books and records reasonably requested by Parent " and the purpose "or purposes of strategic and integration planning for the consummation of the Transactions" and the restrictions "on reasonable advance notice to the Company," "with reasonable access," "uring the Company’s normal business hours " and "; provided that any such access shall be conducted at a reasonable time and in such a manner as not to unreasonably interfere with the normal operation of the business of the Company."
~~~~

**Required repair disposition**

Add subtype-required fields and source coverage. The repaired rule must expose every material condition, exception, scope, party and timing term identified by Ben.

### 45. INTERIM_OPERATING, REVIEW_ONLY_NO_NORMAL_ROW

- Agreement: AbbVie / Landos
- Agreement ID: `f4a123d7c2bd8ba6358499dd9870513c8bac6a6893985bf5a581a536af280d71`
- Review item ID: `79cfc2747c36bb8d2d709d938aa80aebe8ff880926939ad4c4bac8823e1966ac`
- Section reference: `5.2(a)`
- Ben's decision: `INCORRECT`
- Repair class: `CLASSIFICATION_OR_SEMANTIC_DEPTH_FAILURE`

**Question shown to Ben**

> Is it correct to keep this item out of the normal comparison because an important fact is missing or unclear?

**Source excerpt**

~~~~text
During the Pre-Closing Period, except (x) as expressly required or contemplated under this Agreement or as required by applicable Laws or (y) with the written consent of Parent, which consent shall not be unreasonably withheld, conditioned, or delayed, the Company shall, and shall cause the Company Subsidiaries to, use commercially reasonable efforts to: (i) conduct its business in the ordinary course of business as was being conducted prior to the date of this Agreement and (ii) preserve intact its material assets, business organization and relations with employees, material customers, suppliers, licensors, licensees, Governmental Bodies and any other Person with whom the Company has material business relationships; provided that no action by the Company or any Company Subsidiary with respect to matters specifically addressed by any provision of Section 5.2(b) shall be deemed a breach of this sentence unless such action would constitute a breach of such other provision.
~~~~

**Compact comparison shown**

~~~~text
None.
~~~~

**Expanded comparison shown**

~~~~text
None.
~~~~

**Ben's note, verbatim**

~~~~text
None.
~~~~

**Required repair disposition**

Prove the correct family and subtype from the operative unit. Render the typed hierarchy and legal features instead of a broad label.

### 46. KEY_DEFINED_TERMS, REVIEW_ONLY_NO_NORMAL_ROW

- Agreement: AbbVie / Landos
- Agreement ID: `f4a123d7c2bd8ba6358499dd9870513c8bac6a6893985bf5a581a536af280d71`
- Review item ID: `7a43a4f49987b14e305ff75fbb84c42907c82e3f3291be8769e8d725d5522264`
- Section reference: `Exhibit-A`
- Ben's decision: `INCORRECT`
- Repair class: `CLASSIFICATION_OR_SEMANTIC_DEPTH_FAILURE`

**Question shown to Ben**

> Is it correct to keep this item out of the normal comparison because an important fact is missing or unclear?

**Source excerpt**

~~~~text
For purposes of this Agreement (including this EXHIBIT A):
“Acquired Companies” means the Company and the Company’s Subsidiaries, collectively.
~~~~

**Compact comparison shown**

~~~~text
None.
~~~~

**Expanded comparison shown**

~~~~text
None.
~~~~

**Ben's note, verbatim**

~~~~text
This is a definition of acquired companies. You don't need the text that says "for the purposes of this agreement." That's just intro text.
~~~~

**Required repair disposition**

Prove the correct family and subtype from the operative unit. Render the typed hierarchy and legal features instead of a broad label.

### 47. MAE_DEFINITION, REVIEW_ONLY_NO_NORMAL_ROW

- Agreement: AbbVie / Landos
- Agreement ID: `f4a123d7c2bd8ba6358499dd9870513c8bac6a6893985bf5a581a536af280d71`
- Review item ID: `27a9c4067171a3410f4c96ed2456ff4f9dda3c3efcc821da4b5155c90b9e3730`
- Section reference: `Exhibit-A(ii)`
- Ben's decision: `INCORRECT`
- Repair class: `CLASSIFICATION_OR_SEMANTIC_DEPTH_FAILURE`

**Question shown to Ben**

> Is it correct to keep this item out of the normal comparison because an important fact is missing or unclear?

**Source excerpt**

~~~~text
“Material Adverse Effect” means an event, effect, change, occurrence, condition, or development (an “Effect”) that, individually or taken together, has had or would reasonably be expected to have a material adverse effect on the business, assets, properties, liabilities, operations, condition (financial or otherwise), or results of operations of the Acquired Companies, taken as a whole; provided that no Effect arising out of or resulting from any of the following shall be deemed either alone or in combination to constitute or will be taken into account when determining whether a Material Adverse Effect has occurred or would reasonably be expected to occur: (a) any change in the market price or trading volume of the Company’s stock (including the Company Common Stock); (b) the execution, announcement or consummation of the Transactions (including the identity of Guarantor, Parent or Merger Sub) (other than for purposes of any representation or warranty in Section 3.5 or Section 3.12(k) but subject to disclosures in Section 3.5 of the Company Disclosure Schedule); (c) general changes or developments in the clinical stage biopharmaceutical industry or changes in the economy generally or changes in other general business, financial, or market conditions (including interest rates, exchange rates, tariffs, trade wars, and credit markets); (d) general changes or developments in the fluctuations in the value of any currency; (e) (i) changes to any domestic, foreign or global political condition, (ii) any act of terrorism, war (whether or not declared), civil unrest, civil disobedience, protests, public demonstrations, insurrection, national or international calamity, sabotage or terrorism, (iii) any pandemic or epidemic or other outbreak of contagious diseases (or the escalation or worsening of any of the foregoing) or (iv) any volcano, tsunami, earthquake, hurricane, tornado, other natural or man-made disaster, or any similar force majeure event; (f) the failure of the Acquired Companies to meet internal or analyst’s expectation, forecast, estimate, or prediction in respect of revenues, earnings, or other financial or operating metrics for any period; (g) any action taken (or failure to act) by the Company at the written direction of Parent and any action specifically required to be taken by the Company under this Agreement (excluding the requirement that the Company to conduct its business in all material
A-9
respects in the ordinary course); or (h) any change or proposed change in any Law or GAAP after the date hereof; it being understood that the exceptions in clauses (a) and (f) shall not prevent, or otherwise affect a determination that the underlying cause of any such change, decline or failure referred to therein (if not otherwise falling within any of the exceptions provided by clauses (b) through (e) or (g) and (h) hereof) has been or would be reasonably expected to be a Material Adverse Effect or has otherwise resulted in or contributed to a Material Adverse Effect; except, in the case of each of clauses (c), (d), (e) and (h), to the extent that such Effect adversely disproportionately affects the Acquired Companies, taken as a whole, compared to other similar biopharmaceutical companies, in which case only the incremental disproportionate adverse impact may be taken into account in determining whether there has been, or would reasonably expected to be, a Material Adverse Effect.
~~~~

**Compact comparison shown**

~~~~text
None.
~~~~

**Expanded comparison shown**

~~~~text
None.
~~~~

**Ben's note, verbatim**

~~~~text
This is an MAE definition. You should understand this.
~~~~

**Required repair disposition**

Prove the correct family and subtype from the operative unit. Render the typed hierarchy and legal features instead of a broad label.

### 48. MAE_DEFINITION, REVIEW_ONLY_NO_NORMAL_ROW

- Agreement: AbbVie / Landos
- Agreement ID: `f4a123d7c2bd8ba6358499dd9870513c8bac6a6893985bf5a581a536af280d71`
- Review item ID: `bca99d26a601dd17adc28a189d60e32c0d068ecd6ad37024c03fc78c3d1db796`
- Section reference: `Exhibit-A(ii)`
- Ben's decision: `INCORRECT`
- Repair class: `CLASSIFICATION_OR_SEMANTIC_DEPTH_FAILURE`

**Question shown to Ben**

> Is it correct to keep this item out of the normal comparison because an important fact is missing or unclear?

**Source excerpt**

~~~~text
“Parent Material Adverse Effect” means an Effect that would prevent, materially delay, or materially impair the ability of Parent or Merger Sub to perform their respective obligations under this Agreement or the CVR Agreement or to consummate the Transactions.
~~~~

**Compact comparison shown**

~~~~text
None.
~~~~

**Expanded comparison shown**

~~~~text
None.
~~~~

**Ben's note, verbatim**

~~~~text
This is parent MAE. You need to pick up the factors that would prevent, materially delay, or materially impair, and also or consummate.
~~~~

**Required repair disposition**

Prove the correct family and subtype from the operative unit. Render the typed hierarchy and legal features instead of a broad label.

### 49. MERGER_STRUCTURE_CLOSING, REVIEW_ONLY_NO_NORMAL_ROW

- Agreement: AbbVie / Landos
- Agreement ID: `f4a123d7c2bd8ba6358499dd9870513c8bac6a6893985bf5a581a536af280d71`
- Review item ID: `aa8aedf53b5aa210b5f50c5704e3ee183c0cc9eb794179bdf7959cd321726468`
- Section reference: `1.1`
- Ben's decision: `INCORRECT`
- Repair class: `CLASSIFICATION_OR_SEMANTIC_DEPTH_FAILURE`

**Question shown to Ben**

> Is it correct to keep this item out of the normal comparison because an important fact is missing or unclear?

**Source excerpt**

~~~~text
On the terms and subject to the conditions set forth in this Agreement, and in accordance with the DGCL, at the Effective Time, Merger Sub shall merge with and into the Company, the separate corporate existence of Merger Sub shall cease, and the Company shall continue its corporate existence under the laws of the State of Delaware (“Delaware Law”) as the Surviving Corporation and a wholly owned Subsidiary of Parent.
~~~~

**Compact comparison shown**

~~~~text
None.
~~~~

**Expanded comparison shown**

~~~~text
None.
~~~~

**Ben's note, verbatim**

~~~~text
This is a topology question describing the form of the merger.
~~~~

**Required repair disposition**

Prove the correct family and subtype from the operative unit. Render the typed hierarchy and legal features instead of a broad label.

### 50. MISC_BOILERPLATE, REVIEW_ONLY_NO_NORMAL_ROW

- Agreement: AbbVie / Landos
- Agreement ID: `f4a123d7c2bd8ba6358499dd9870513c8bac6a6893985bf5a581a536af280d71`
- Review item ID: `ac32a47a8d51fb37d73ef91dc7a438e0e1b4b2b544bc60183ddc68c41da0eaef`
- Section reference: `8.3`
- Ben's decision: `INCORRECT`
- Repair class: `CLASSIFICATION_OR_SEMANTIC_DEPTH_FAILURE`

**Question shown to Ben**

> Is it correct to keep this item out of the normal comparison because an important fact is missing or unclear?

**Source excerpt**

~~~~text
This Agreement, the Ancillary Agreements, and the other agreements, exhibits, annexes, and schedules referred to herein constitute the entire agreement and supersede all prior agreements and understandings, both written and oral, among or between any of the Parties, with respect to the subject matter hereof and thereof; provided that the Confidentiality Agreement shall not be superseded and shall remain in full force and effect; provided, further, that, if the Effective Time occurs, the Confidentiality Agreement shall automatically terminate and be of no further force and effect.
~~~~

**Compact comparison shown**

~~~~text
None.
~~~~

**Expanded comparison shown**

~~~~text
None.
~~~~

**Ben's note, verbatim**

~~~~text
This is an entire agreement provision.
~~~~

**Required repair disposition**

Prove the correct family and subtype from the operative unit. Render the typed hierarchy and legal features instead of a broad label.

## 4. Repair-set accounting

| Repair class | Ordinals | Count |
|---|---|---:|
| Material meaning omitted or hidden | 1, 2, 4, 6, 7, 8, 9, 10, 13, 18, 19, 22, 23, 24, 25, 28, 31, 34, 35, 36, 44 | 21 |
| Classification or semantic-depth failure | 14, 20, 27, 33, 38, 40, 42, 43, 45, 46, 47, 48, 49, 50 | 14 |
| Source artefact | 15 | 1 |
| False parser ambiguity | 39 | 1 |
| Approved no-comparison | 41 | 1 |
| Clean regression controls | 3, 5, 11, 12, 16, 17, 21, 26, 29, 30, 32, 37 | 12 |

The repair set is 38 items. The clean control set is 12 items. Sample membership, order, source identities and human answers must remain fixed.
