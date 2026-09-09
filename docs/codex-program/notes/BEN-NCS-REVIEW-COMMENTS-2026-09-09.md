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
