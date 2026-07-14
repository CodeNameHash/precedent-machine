# Round-2 corpus prune — DRAFT for Ben (2026-07-14)

Nothing here has been applied. Decisions file:
`scripts/curation/decisions/2026-07-round2-DRAFT.json`. Dry-run verified against the
live DB (all coverage checks pass; the tool blocks the whole run until every item is
resolved).

Context: after TASK 3, 22 deals had rematerialize ambiguities/card-less rows. Matcher
refinements (heading-phrase strip, text+title tie-break, containment rung — commit
`17e8696`) resolved most mechanically: ambiguity groups went 23 → 13, clean deals
18 → 20, +22 matched pairs, with pair-level invariance proven against the prior corpus
apply. What remains is genuinely decisional and splits four ways.

## A. Verbatim-covered duplicate deletes (9 cards — pilot pattern, ready on your "go")

| deal | card | title | covered by |
|---|---|---|---|
| TopBuild | 7309b39f | Tail Provision (Parent-side dup) | e06e2d20 Reverse Termination Fee |
| TopBuild | 0acfee2c | Change of Recommendation (force-the-vote proviso) | 00467dda Intervening Event |
| TopBuild | 360b7fd6 | Solicitation Prohibition (no-alt-agreement fragment) | 00467dda Intervening Event |
| TopBuild | ca9e4d4c | Solicitation Prohibition (inform-Representatives sentence) | 1de6dcb8 Superior Proposal Definition |
| Concho | 71cf5c45 | Exceptions / Fiduciary Out (Parent inform-third-party) | 3b49171d Solicitation Prohibition |
| Concho | a26babab | Provision of Information to Bidder (Company) | af1b8c9d Exceptions / Fiduciary Out |
| Concho | c42e9451 | Provision of Information to Bidder (Parent) | d43585a0 Exceptions / Fiduciary Out |
| Starwood | f008725e | Change of Recommendation (Marriott fiduciary passage) | 9843cdfd Change of Recommendation |
| Starwood | 76c01cf5 | Notice to Counterparty (matching-rights fragment) | 2486e454 Notice to Counterparty |

Each delete also unblocks a rung-1 match for the surviving same-title card (e.g.
Concho 1cc83639 ↔ af1b8c9d, TopBuild 8ba3dcf3 ↔ 9fce96fe). Two carry alternatives
noted in the decisions file (360b7fd6 could instead become a "Force the Vote" row;
ca9e4d4c could sit beside "Breach by Representatives" as an obligations-notice row) —
default is delete since the text is verbatim-preserved in the covering row.

## B. Landos b6f353e2 — delete with content-loss ack (your explicit ack required)

Stale mis-titled "Disclosure of Terms" card whose 1,982-char text is the OLD carve of
the Notification-of-Proposals clause. It head-collides with the true Notice card
(dfe1ac55), blocking that card's match to provision 355c6464. The re-extraction
re-carved the clause, so the old carve is not verbatim inside any single current
provision — the tool holds it at NEEDS-RECONFIRM until you add `ackUncovered`.

## C. Design decision — party scope on reciprocal deals (blocks the rest)

Concho, Starwood, and TopBuild are reciprocal (both sides carry no-shop machinery).
Extraction produces Company-side AND Parent-side provisions under one category
("Enforcement of Standstills" ×2, Marriott/Starwood COR and Notice twins, 3 Parent-side
COR provisions on TopBuild). The taxonomy's scope axis (`party`) has no NOSOL surface, so
these collide. Proposal: adopt a **"(Parent)" title suffix** for acquirer-side rows of
reciprocal deals (e.g. "Enforcement of Standstills (Parent)"), applied to BOTH the
provision category and the card title, corpus-wide rule. Executing needs a small
provisions-recategorize action added to the prune tool (it writes only cards today).
Alternatives: a real party axis on NOSOL types (heavier, cleaner), or leave Parent-side
rows card-less until M3.

## D. Generalize your Kraft decision — "Breach by Representatives"

Cooper Tire provision 6ac86d53 is the exact analog of Kraft 10792e76 (violation-by-
directors/officers-is-company-breach). Recategorizing it to "Breach by Representatives"
resolves Cooper's last ambiguity (d0458c88 then pairs 1:1 with 19a89efc). Same recat
mechanism as C.

## E. Not prune material (logged for M3 / GAP-C)

Starwood's three 248–261-char "Disclosure of Terms" fragment provisions are extraction
over-splitting; the remaining card-less coded provisions (59 corpus-wide) are the M3
card-writing backlog.

## What "go" looks like

1. You reply per section: A "go/no" (± the two alternatives), B ack text or "hold",
   C pick a convention, D "go/no".
2. A+B execute via `prune-cards.js --apply --backup` (dry-run shown first, as always);
   C+D need the recat extension first (small, spec'd once you choose).
3. Then a final corpus rematerialize pass + refreshed population matrix.
