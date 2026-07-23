# Freeze-gate amendment proposal: termination-fee trigger vocabulary

Authorized by Ben 2026-07-23 (QXO briefing Q5: "Authorize"), with his
rulings applied: breach-triggered fees are termination fees sharing the
trigger vocabulary (Q1); the no-vote / naked-no-vote distinction is
preserved, schema design deferred to Fable (Q2); Fable proposes exact
code names (Q3); reviewed payloads build from source text (Q4).

Evidence base: the corpus-wide legacy vocabulary
(`lib/taxonomy.js` `TERMF_TRIGGER_META`, distilled from all 40 deals) —
NOT one agreement — plus the QXO/TopBuild filed agreement (Ex. 2.1 to
QXO's 8-K, accession 0001104659-26-045111, §6.5) as the first canonical
fixture deal.

## Design rule (the schema decision Ben deferred)

A `trigger_code` names the TERMINATION GROUND — the right actually
exercised. Tail mechanics, competing-proposal predicates, and windows are
`trigger_condition` codes plus `payment_timing`, composed per the
programme's `TRIGGERS_REMEDY` relationship model (this is exactly how the
three frozen Landos codes already work). Consequences:

- The naked-no-vote distinction is carried by CONDITIONS on one
  vote-failure ground (`NO_COMPETING_PROPOSAL_PENDING` vs
  `COMPETING_PROPOSAL_PUBLICLY_PENDING`), not by two overlapping ground
  codes — the distinction Ben requires survives, and it composes
  correctly for deals like QXO where vote-failure is tail-only.
- The existing frozen codes stay untouched (never renamed):
  `SUPERIOR_PROPOSAL_TERMINATION`, `CHANGE_IN_RECOMMENDATION_TERMINATION`
  (which in the frozen fixture means an ADVERSE recommendation change),
  `ACQUISITION_PROPOSAL_TAIL`.

## Proposed new trigger_code values (for Ben's yes/no on the names)

| Proposed code | Plain meaning | Corpus evidence (legacy code) |
|---|---|---|
| `INTERVENING_EVENT_RECOMMENDATION_CHANGE_TERMINATION` | Board changed recommendation for an intervening event (distinct legal ground from an adverse/competing-proposal COR — QXO §6.4(a)(i)(B) keeps them separate) | subsumed in legacy RECOMMENDATION_CHANGE |
| `NO_SOLICIT_BREACH_TERMINATION` | Counterparty terminated for material breach of the no-solicitation covenant | NO_SOLICIT_BREACH |
| `STOCKHOLDER_APPROVAL_FAILURE_TERMINATION` | Vote taken and approval not obtained (naked vs not carried by conditions) | NO_VOTE + NAKED_NO_VOTE |
| `COUNTERPARTY_COVENANT_BREACH_TERMINATION` | General covenant/rep breach termination (bring-down/MAE-gated) | COMPANY_BREACH + PARENT_BREACH (side carried by party fields, not the code) |
| `OUTSIDE_DATE_TERMINATION` | Outside-date termination | OUTSIDE_DATE |
| `ANTITRUST_FAILURE_TERMINATION` | Regulatory/antitrust failure ground | ANTITRUST_FAILURE |
| `FINANCING_FAILURE_TERMINATION` | Financing failure ground (reverse fees) | FINANCING_FAILURE |

New `trigger_condition` values: `COMPETING_PROPOSAL_PUBLICLY_PENDING`,
`NO_COMPETING_PROPOSAL_PENDING`, `STOCKHOLDER_APPROVAL_NOT_YET_OBTAINED`.
(The existing twelve-month/50%-threshold tail conditions are already
frozen.) Legacy `OTHER` gets no canonical code — unfamiliar grounds
quarantine, per the residual rule.

## Source-integrity findings (must be recorded with the amendment)

1. The repo-side reconstruction of QXO card `fec8549c`'s triggers cites
   sections (`8.02(...)`) that do not exist in the filed agreement
   (termination is Article VI, §§6.1–6.5) and includes an
   eighteen-month tail row with zero support in the document. The
   reconstruction lives in `tests/termf-tail-trigger-dedup.test.js`;
   whether the LIVE card matches it needs Ben's one-look check. Either
   way the canonical fixture builds from the EDGAR text (Q4 ruling).
2. The real §6.5(b) makes vote-failure TAIL-ONLY (never immediate-pay),
   contradicting the "COR-change / no-vote" two-direct-pills expectation
   in UI-FEEDBACK Item 9. The canonical fixture will encode the
   agreement, not the legacy expectation.
3. QXO's two immediate-pay grounds bundle adverse-COR and no-solicit
   breach under one two-business-day timing; the ground codes stay
   distinct (different rights exercised), the shared timing is data.

## Implementation packet (on Ben's name approval)

Frozen-slice vocabulary additions + QXO termination reviewed fixture
built verbatim from Ex. 2.1 §§6.2–6.5 (both fee sides — the mirror
Parent fee exercises `FINANCING_FAILURE_TERMINATION`-class grounds no:
the mirror uses the same grounds swapped; reverse-fee METRIC remains a
separate later change) + staging script pair + composition tests, full
review lane, staged, flag-off. Contract fingerprint WILL move — that is
the point of a freeze-gate amendment; the status artifact records the
new fingerprint at generation 3 with this document as evidence.
