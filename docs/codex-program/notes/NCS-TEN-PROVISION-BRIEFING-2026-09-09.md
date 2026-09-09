# NCS ten-provision review briefing, 2026-09-09

Run `eaafcac8-790b-41bb-a5e1-b12187a55e7d`, revision 0. Read directly from the
private database (Supabase preview branch `pm-product-restore-20260905`,
project ref `ecrtoofsyxozazkvsvcl`). Counts confirmed there: 1,039 proposals,
164 relationships, 86 issues, 53 unresolved coverage records, 182 NOT_FOUND
family or fact-type records, 144 residual-paragraph records, 8 immaterial
routings, 104 sections. That is the 1,672 shown on the page.

Each item below gives: the deal point as I read the source, what the draft
says, and what is wrong or missing. "Comment" is Ben's slot. Nothing here is a
review decision. Assistant reading of the source is not lawyer review.

Ben's note on 7.1(c)(iv) and the fee tail is already recorded in
`BEN-NCS-REVIEW-COMMENTS-2026-09-09.md`.

## Systemic defects seen across the ten

These recur in every section and are the reason the page reads as noise.

- **S1. Subtype forced into the wrong bucket, then roles filled with nonsense.**
  The schema only has vote-deal subtypes, so written-consent and support
  agreement mechanics are labelled Vote failure, Proxy filing deadline or
  Meeting convene obligation, and the role slots (`required_vote`,
  `adjournment_scope`, `meeting_completion_trigger`) hold unrelated text.
  Affirmative no-shop duties (cease discussions, return information) are
  labelled Prohibited action. Expense allocation puts the expense in the
  `payee` slot. The roles are not quotes and are not checked; only the
  evidence quotes are verified against the source.
- **S2. Held facts are invisible.** Where the model proposed a subtype the
  schema lacks, the whole fact is parked as an issue ("Held model-proposed
  content") and does not appear as a fact. Two of these are material: the
  Parent Termination Fee election right (7.3(b)) and every dollar threshold
  in the Material Contracts rep (3.16). See items 2 and 8.
- **S3. Chapeau repeated on every limb.** Every 7.1 right begins with the
  full 43-word chapeau; every 6.x condition with "The obligation of each
  Party to effect the Merger is subject to…"; every 5.3 prerequisite with
  "Prior to the Company Board effecting an Adverse Recommendation Change in
  accordance with the immediately prior sentence". This is the prompt
  working as instructed.
- **S4. Derived facts duplicate their parent and are marked invalid.** 7.1 has
  three extra cards (two cure periods, one outside date value) that restate
  parts of rights already captured, and they fail validation for value
  mismatch. Same for the 5.3 match periods ("Business Day period" is not a
  numeral).
- **S5. Abstracted statements.** Several 5.2 exceptions read "if the stated
  Acquisition Proposal and fiduciary-duty prerequisites are satisfied", with
  the real prerequisites only in a role. The prompt forbids exactly this.

## 1. Termination rights, Section 7.1 (14 cards, 3 invalid)

Deal point: mutual consent; outside date 31 May 2027 5pm Central with no
automatic extension; final non-appealable restraint after reasonable best
efforts to contest; mutual breach rights with 30-day cure capped at the
outside date and a terminator-breach bar; Parent may terminate for Adverse
Recommendation Change, for non-delivery of the Written Consent, or for
non-delivery of the Support Agreement, each only until the consent or
agreement is delivered; Company may terminate for a Superior Proposal (fee
paid first, until Written Consent delivered) and, unusually, if the Novation
under 5.19 is not effective by the day after the "Rewind" closing.

Draft: all eleven rights present with accurate text. Three added cards
restate the cure periods and outside date and fail validation. Findings:

- 7.1(c)(iii) and (c)(iv) are labelled Vote failure (Ben's point). Schema gap.
- 7.1(d)(iii), the Novation/Rewind right, is labelled Outside date. It is a
  bespoke right tied to a Parent-side assignment and a separate transaction
  called Rewind. It deserves its own label and a link to 5.19 and to the
  Parent Termination Fee trigger in 7.3(b)(i).
- The chapeau's parenthetical "(with any termination by Parent also being an
  effective termination by Merger Sub)" is dropped from every statement.
- Six "REQUIRES" relationship proposals were rejected as not allowed for the
  family, so the fee-first condition on 7.1(d)(ii) is not linked to 7.3.

Comment:

## 2. Termination fees and remedies, Section 7.3 (21 cards)

Deal point: Company Termination Fee $5.5m, payable on (i) breach or outside
date termination plus a public proposal plus a 12-month tail, with the
Acquisition Proposal threshold deemed 50% for the tail, (ii) Superior
Proposal termination, (iii) Parent termination for recommendation change or
non-delivery of consent or support agreement. Parent Termination Fee $9.7m
on (i) Novation failure or (ii) Parent breach of 5.1(c). Company must elect
within 7 business days to accept or decline the Parent fee; silence is
acceptance and a waiver of all claims including wilful breach and fraud.
Parent's exclusive remedy carves out fraud and wilful breach; the Company's
does not. Neither side may get both specific performance to closing and a
fee or damages. Expenses borne by incurring party except S-4/Information
Statement costs shared and HSR fees on Parent.

Draft: fee amounts, all triggers, both exclusive-remedy limitations with the
asymmetry preserved, deemed-acceptance waiver, no-double-recovery, expense
rules all present. Findings:

- The election right itself ("the Company shall, within seven Business Days,
  irrevocably elect in writing to accept or decline") is held as an
  unsupported subtype and is not a fact. Only its consequence survived.
  Material omission from the reader's view.
- The 7.3(a)(i) trigger statement carries the whole tail in one sentence
  (Ben's point). A separate Tail period fact exists (12 months, 50% deeming
  in a role), but the trigger card duplicates it and its statement omits the
  50% deeming and the "clause (B)" it cites is not visible.
- The 7.3(b)(ii) trigger, "Parent's breach of Section 5.1(c)", is stated but
  nothing explains what 5.1(c) is. A reader needs the cross-reference.
- The VAT warranty sentence and the liquidated-damages acknowledgements are
  captured or held. Immaterial; candidates for coverage-only.

Comment:

## 3. No solicitation, Section 5.2 (19 cards)

Deal point: standard no-shop from signing to closing or termination; cease
existing discussions, cut data-room access, request return of information
for proposals in the prior six months; fiduciary exception only before the
Written Consent is received, for a bona fide unsolicited proposal that is or
could reasonably be expected to lead to a Superior Proposal, subject to an
Acceptable Confidentiality Agreement and 48-hour information parity; 48-hour
notice of proposals with unredacted copies; Acquisition Proposal 20%,
Superior Proposal deemed 80%; Acceptable Confidentiality Agreement may not
grant exclusivity, block compliance or require expense reimbursement.

Draft: prohibitions, clean-up duties, three fiduciary-exception limbs, notice
and update duties, both definitions with thresholds. Findings:

- The Acceptable Confidentiality Agreement definition (5.2(e)(iii)) has no
  fact. Its no-exclusivity and no-expense-reimbursement limbs are deal terms.
- The three exception limbs each restate the full prerequisite in a role
  while the statement says "the stated … prerequisites". Reader sees the
  abstraction.
- Cease-discussions, data-room and return-of-information duties are labelled
  Prohibited action.
- Once the Written Consent is delivered the fiduciary exception, the notice
  duty and the recommendation-change right all fall away, but the no-shop
  itself runs to closing. This is the practical point of the section and it
  is only visible by reading each card's timing text.

Comment:

## 4. Board recommendation and match right, Section 5.3 (10 cards, 2 invalid)

Deal point: no Adverse Recommendation Change or alternative agreement except
via 5.2(c); change permitted only for a Superior Proposal, only until the
Written Consent is received; written notice, summary and copies; four
business day negotiation at Parent's request; board re-determination after
the period; two business days for amended proposals. No intervening-event
change. No termination right for the Company on a recommendation change
without a Superior Proposal.

Draft: all limbs present. Findings:

- Both match-period facts are invalid because the unit was written as
  "Business Day period". The 4 and 2 day values are correct.
- The absence of an intervening-event change is the notable point and is not
  stated anywhere; the schema has no way to say it.
- The tender-offer limb (stop-look-listen within ten business days) is
  correctly captured.

Comment:

## 5. Closing conditions, Sections 6.1 to 6.3 (28 cards, all valid)

Deal point: mutual conditions are Written Consent obtained and not revoked,
no restraint, HSR expiry plus scheduled approvals, Nasdaq listing, S-4
effective with no stop order, Information Statement mailed at least 20
business days before closing. Parent conditions: three-tier bring-down
(specified reps in all respects, capitalisation de minimis, fundamental reps
in all material respects, the rest at MAE with materiality scrape),
covenants in all material respects, certificate, no MAE. Company conditions
mirror, plus a tax opinion on Intended Tax Treatment with a five-percent
transferee shareholder carve-out, and a bespoke condition that the Company
has remitted Canadian and Alberta tax deposits for its Notice of Objection.

Draft: every condition present, tiers separated, scrape captured, tax
remittance condition captured. This is the cleanest section reviewed.
Findings:

- An eleventh 6.1 card says only "…is subject to the satisfaction … of the
  following conditions." It is a chapeau captured as a fact.
- The Nasdaq listing condition is labelled Legal restraint / Listing
  condition.
- Cross-references (3.9(c), 3.20, 3.21, 3.2(a), 3.25, 4.8, 4.11) are bare;
  the reader cannot tell which reps carry the "all respects" standard.

Comment:

## 6. Specific performance, Section 8.10 (6 cards)

Deal point: mutual specific performance in Delaware Chancery, cumulative
rights, waiver of adequacy defence and bond, and 7.3 does not diminish it.

Draft: complete and accurate, though split into six cards for a five-line
section, and the fee-versus-performance coordination lives in 7.3 (item 2).

Comment:

## 7. Regulatory efforts, Section 5.8 (41 cards, 1 held)

Deal point: Parent "agrees to take all actions" to consummate (unqualified);
Company uses reasonable best efforts. Neither side is required to divest,
accept conduct restrictions or litigate, and the Company may not do so
without Parent consent. Parent controls regulatory strategy after
consultation, with review, comment and keep-informed obligations. HSR filing
within 10 business days; scheduled foreign filings within 20; second-request
compliance; expiry sought by the Outside Date. Parent free to make other
acquisitions subject to 5.1(b).

Draft: all of that is present and the Parent/Company efforts asymmetry is
kept as separate facts. Findings:

- 41 cards for one section. The (x)/(y) no-burden sentence alone produced six
  cards (three limbs times two subjects). A reader wants one statement: no
  divestiture, no conduct remedy, no litigation, for either party.
- The 5.8(a) "Parent agrees to take all actions" standard is the single most
  important word choice in the section and is not flagged as unusual.
- "(vii) give the other reasonable notice" is held as an unsupported subtype
  "NOTIFICATION"; the attend-and-participate half survived.

Comment:

## 8. Material Contracts rep, Section 3.16 (29 cards, 2 invalid, 8 held)

Deal point: thirteen listed categories with thresholds of $250,000
(indebtedness; loans, investments or assumed liabilities), $750,000
(aggregate payments over remaining term), $100,000 (inbound IP licences),
settlements since 1 January 2024; status reps at MAE with knowledge
qualifiers for counterparties.

Draft: every category present as a "listed Material Contract category" card
and the MAE-qualified status reps split into six cards. Findings:

- Every threshold value is held. The model proposed a
  `MATERIAL_CONTRACT_THRESHOLD_STRUCTURE` subtype for each dollar figure;
  the schema has none, so $250,000, $750,000 and $100,000 exist only inside
  held issues and the category cards' prose. Ben asked specifically for
  thresholds; the product cannot currently surface them as values.
- Two category cards (both 3.16(a)(ix)) are invalid as duplicates of each
  other with slightly different wording.
- Each category card ends with the same 30-word chapeau restatement.

Comment:

## 9. Written Consent and Support Agreement, Section 5.6 (4 cards)

Deal point: no stockholder meeting. Consent solicited immediately after
signing; reasonable best efforts to obtain the Written Consent and Support
Agreement counterparts by 11:59pm Central the day after signing (the Consent
Time); consent effective on delivery under DGCL 228; copy to Parent by the
Consent Time. This drives the Parent termination rights in 7.1(c)(iii) and
(iv) and the fee in 7.3(a)(iii).

Draft: four cards, each labelled with proxy-meeting subtypes (Proxy filing
deadline days, Meeting convene obligation). The sentence "shall submit the
form of Written Consent attached hereto as Exhibit A and the Consenting
Stockholders" is captured verbatim, including the source's own grammatical
gap.

- No relationship links 5.6 to 7.1(c)(iii)/(iv), 6.1(a) or 7.3(a)(iii).
- The Consent Time is defined here and used in three other sections; nothing
  ties them together.

Comment:

## 10. Control: Interpretation, Section 8.4 (21 cards)

Twenty-one facts including "the term 'or' is not exclusive" and "'will' has
the same meaning as 'shall'". All accurate. None is a key provision. This is
what the "every provision is material" rule produces; it is the clearest
case for a coverage-only family.

Comment:

## Two schema questions that fall out of the ten

1. Written-consent deals: add subtypes for consent solicitation, support
   agreement delivery and consent-based termination, or map them to existing
   ones with new labels? The current mislabelling is systematic, not a
   one-off.
2. Thresholds: should a dollar or percentage threshold inside a rep be a
   fact with a canonical value (as fee amounts are), or a role on the
   category fact? Today it is neither, because the model invents a subtype
   and the schema rejects it.

Either change is material under the plan's testing rule and needs an
untouched agreement afterwards.
