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
