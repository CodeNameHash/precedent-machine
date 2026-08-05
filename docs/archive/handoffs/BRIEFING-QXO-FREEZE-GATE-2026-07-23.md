# Briefing: QXO termination taxonomy Freeze Gate — what it needs from Ben

Requested via DECISIONS 2026-07-23 (D4: walkthrough). Fable-distilled from
a full repo survey; every claim carries a file pointer. No code value is
proposed anywhere in this document — taxonomy is yours.

## What the gate actually is

The canonical-v2 termination-fee slice
(`lib/canonical-v2/reviewed-termination-fee-slice.js:297-309`) freezes
exactly three `trigger_code` values, all derived from the Landos/AbbVie
fixture deal: `SUPERIOR_PROPOSAL_TERMINATION`,
`CHANGE_IN_RECOMMENDATION_TERMINATION`, `ACQUISITION_PROPOSAL_TAIL`.

QXO's actual termination-fee provision (legacy card `fec8549c`, triggers
per `docs/handoffs/UI-FEEDBACK-R3-SPEC-2026-07-18.md` Item 9) carries
trigger types with **no canonical-v2 counterpart**: a no-vote fee and
breach-based fees (`NO_VOTE`, `NO_SOLICIT_BREACH`/`COMPANY_BREACH` in the
legacy vocabulary, `lib/taxonomy.js:928-981`, which already covers them at
the V1 layer — that layer is NOT what's blocked). Building the QXO
termination canonical slice — the missing sibling of the existing QXO
capitalisation/no-shop/material-contracts slices — therefore requires
widening the frozen canonical vocabulary, which only a Freeze Gate PR you
approve can do (`docs/CODEX-PROGRAM.md:244`,
`docs/codex-program/canonical-contracts.md:1787-1789`).

Downstream, this same gate parks the reverse/buyer termination fee Query
metric (`PROPOSAL-CANONICAL-QUERY-UI-NEXT-SLICES-2026-07-23.md`).

## The five questions, in order (answers close the gate)

1. **Scope**: are breach-triggered fees (company breach / no-solicit
   breach) inside the canonical "termination fee" concept's
   `TRIGGERS_REMEDY` model, or a legally distinct animal that must not
   share the `trigger_code` vocabulary?
   Review: `docs/CODEX-PROGRAM.md:638-656` (binding termination-fee
   architecture) against QXO §6.5's actual clause text via card
   `fec8549c`.
2. **No-vote**: does QXO's stockholder-vote-failure fee warrant its own
   frozen code, or fold into an existing one? Note the legacy vocabulary
   deliberately distinguishes `NO_VOTE` from `NAKED_NO_VOTE`
   (`lib/taxonomy.js:948-958`) — decide whether canonical-v2 preserves
   that distinction.
3. **Naming**: for each new code, fix the exact identifier following the
   existing `<CONDITION>_<MECHANISM>` shape; codes are stable cross-deal
   identifiers — added, never renamed.
4. **Data repair first?** The QXO card's 7 stored trigger entries include
   5 mis-coded tail sub-limbs (root cause `lib/termf.js:135-170`, per
   UI-FEEDBACK Item 9). Decide whether a `--types TERMINATION_FEE`
   per-type refresh repairs the card before any canonical slice is built
   from it.
5. **Authorize** the Freeze Gate PR (or defer). On approval the work is:
   new frozen codes in `reviewed-termination-fee-slice.js` (+ any new
   relationship/effect schema for breach triggers), a
   `qxo-termination-fee-row` fixture + staging script pair, candidate-seed
   entry, and tests proving composition against QXO's real spans — all
   Fable-reviewed, staged only, flag-off, activation still yours.

## What I can prepare without you

Nothing that touches vocabulary. On your answers to 1–4, I can draft the
Freeze Gate PR same-day with the full review lane. Until then the gate
stays parked, as found.
