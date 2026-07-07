---
vocab: FROZEN-party_role-v1
key: company
label: Company
stability: STABLE
anchor_citation:
  deal: Pfizer Inc. / Metsera, Inc.
  provision_id: party-role-company-anchor
---

The Company is the target-side party whose equity or assets are being acquired, including target and seller formulations in legacy extraction output.

distinguished_from:
- parent: the buyer-side contracting party or acquirer.
- both: a reciprocal obligation or right shared by both sides.

---
vocab: FROZEN-party_role-v1
key: parent
label: Parent
stability: STABLE
anchor_citation:
  deal: Pfizer Inc. / Metsera, Inc.
  provision_id: party-role-parent-anchor
---

Parent is the buyer-side party, including acquirer and buyer formulations in legacy extraction output.

distinguished_from:
- company: the target-side party whose equity or assets are being acquired.
- both: a reciprocal obligation or right shared by both sides.

---
vocab: FROZEN-party_role-v1
key: both
label: Both parties
stability: STABLE
anchor_citation:
  deal: Pfizer Inc. / Metsera, Inc.
  provision_id: party-role-both-anchor
---

Both parties covers mutual, reciprocal, either-party, or shared obligations and rights where the canonical value is not specific to only Company or Parent.

distinguished_from:
- company: Company-only obligations or rights.
- parent: Parent-only obligations or rights.

---
vocab: FROZEN-triggerCode-v1
key: SUPERIOR_PROPOSAL
label: Company terminates for superior proposal
stability: STABLE
anchor_citation:
  deal: Pfizer Inc. / Metsera, Inc.
  provision_id: trigger-superior-proposal-anchor
---

The Company may terminate to enter into or accept a superior acquisition proposal after satisfying the agreement's fiduciary-out mechanics.

distinguished_from:
- BOARD_RECOMMENDATION_CHANGE: buyer termination after an adverse recommendation change rather than Company termination for a superior proposal.
- NAKED_NO_VOTE: termination after a failed vote without a superior proposal trigger.

---
vocab: FROZEN-triggerCode-v1
key: BOARD_RECOMMENDATION_CHANGE
label: Buyer terminates for adverse recommendation change
stability: STABLE
anchor_citation:
  deal: Pfizer Inc. / Metsera, Inc.
  provision_id: trigger-board-recommendation-change-anchor
---

Buyer may terminate because the Company board changes, withdraws, qualifies, or fails to reaffirm its recommendation.

distinguished_from:
- SUPERIOR_PROPOSAL: Company-side superior-proposal termination.
- STOCKHOLDER_VOTE_FAILED: failed approval without a recommendation-change trigger.

---
vocab: FROZEN-triggerCode-v1
key: NAKED_NO_VOTE
label: Naked no-vote termination
stability: STABLE
anchor_citation:
  deal: Pfizer Inc. / Metsera, Inc.
  provision_id: trigger-naked-no-vote-anchor
---

The transaction fails because the required stockholder approval is not obtained, without tying the fee trigger to a superior proposal or recommendation change.

distinguished_from:
- STOCKHOLDER_VOTE_FAILED: the vote failure event itself.
- SUPERIOR_PROPOSAL: vote failure connected to an alternative proposal path.

---
vocab: FROZEN-triggerCode-v1
key: MUTUAL_DROP_DEAD
label: Either party terminates at outside date
stability: STABLE
anchor_citation:
  deal: Pfizer Inc. / Metsera, Inc.
  provision_id: trigger-mutual-drop-dead-anchor
---

Either party may terminate when the outside date arrives and the transaction has not closed, subject to customary breach exclusions.

distinguished_from:
- OUTSIDE_DATE_ELAPSED: the elapsed outside-date event used for fee linkage.
- BUYER_REG_FAILURE: a regulatory failure-specific outside-date pathway.

---
vocab: FROZEN-triggerCode-v1
key: BUYER_REG_FAILURE
label: Buyer regulatory / antitrust failure
stability: STABLE
anchor_citation:
  deal: Pfizer Inc. / Metsera, Inc.
  provision_id: trigger-buyer-reg-failure-anchor
---

Buyer-side failure to obtain required regulatory clearance, satisfy antitrust obligations, or avoid a regulatory restraint causes termination or fee exposure.

distinguished_from:
- LAW_ORDER_PERMANENT_ENJOIN: a final legal restraint regardless of buyer fault.
- MUTUAL_DROP_DEAD: outside-date termination without a buyer-regulatory fault classification.

---
vocab: FROZEN-triggerCode-v1
key: COMPANY_BREACH_MATERIAL
label: Buyer terminates for company material breach
stability: STABLE
anchor_citation:
  deal: Pfizer Inc. / Metsera, Inc.
  provision_id: trigger-company-breach-anchor
---

Buyer may terminate because the Company has materially breached representations, warranties, covenants, or agreements and the breach is not timely cured.

distinguished_from:
- BUYER_BREACH_MATERIAL: Company termination for buyer breach.
- COMPANY_BREACH_FINANCING_COOPERATION: a narrower Company financing-cooperation breach.

---
vocab: FROZEN-triggerCode-v1
key: BUYER_BREACH_MATERIAL
label: Company terminates for buyer material breach
stability: STABLE
anchor_citation:
  deal: Pfizer Inc. / Metsera, Inc.
  provision_id: trigger-buyer-breach-anchor
---

The Company may terminate because Buyer or Parent has materially breached representations, warranties, covenants, or agreements and the breach is not timely cured.

distinguished_from:
- COMPANY_BREACH_MATERIAL: buyer termination for Company breach.
- BUYER_REG_FAILURE: regulatory failure rather than general buyer breach.

---
vocab: FROZEN-triggerCode-v1
key: LAW_ORDER_PERMANENT_ENJOIN
label: Permanent legal enjoinment of the transaction
stability: STABLE
anchor_citation:
  deal: Pfizer Inc. / Metsera, Inc.
  provision_id: trigger-law-order-anchor
---

A final, non-appealable law, order, injunction, or restraint permanently prevents closing the transaction.

distinguished_from:
- BUYER_REG_FAILURE: buyer-attributed regulatory failure.
- MUTUAL_DROP_DEAD: passage of time without a permanent legal restraint.

---
vocab: FROZEN-triggerCode-v1
key: COMPANY_BREACH_FINANCING_COOPERATION
label: Company breach of financing cooperation covenants
stability: PROVISIONAL
anchor_citation:
  deal: Pfizer Inc. / Metsera, Inc.
  provision_id: trigger-financing-cooperation-anchor
---

The Company breaches financing-cooperation covenants in a way that triggers a termination right or fee consequence.

distinguished_from:
- COMPANY_BREACH_MATERIAL: broader Company material breach.
- BUYER_BREACH_MATERIAL: buyer-side material breach.

---
vocab: FROZEN-triggerCode-v1
key: OUTSIDE_DATE_ELAPSED
label: Outside date elapsed (no successful closing)
stability: STABLE
anchor_citation:
  deal: Pfizer Inc. / Metsera, Inc.
  provision_id: trigger-outside-date-elapsed-anchor
---

The outside date has passed without closing, serving as the event key that links outside-date termination rights to related fee triggers.

distinguished_from:
- MUTUAL_DROP_DEAD: the either-party termination right at the outside date.
- BUYER_REG_FAILURE: outside-date failure attributed to buyer regulatory issues.

---
vocab: FROZEN-triggerCode-v1
key: STOCKHOLDER_VOTE_FAILED
label: Company stockholder vote fails to obtain requisite approval
stability: STABLE
anchor_citation:
  deal: Pfizer Inc. / Metsera, Inc.
  provision_id: trigger-stockholder-vote-failed-anchor
---

The Company stockholder vote is held and the requisite approval is not obtained.

distinguished_from:
- NAKED_NO_VOTE: fee-trigger framing for a failed vote without a superior proposal.
- BOARD_RECOMMENDATION_CHANGE: board recommendation conduct rather than the voting result.
