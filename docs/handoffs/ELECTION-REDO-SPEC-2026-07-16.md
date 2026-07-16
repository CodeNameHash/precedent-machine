# Election mechanism redo — spec (2026-07-16)

Ben's ask (verbatim): *"we need to redo the election stuff — needs to say what
the two election options are and be clear which of the consideration parts
apply to which."*

## Why redo, not patch (state of the data as of today)

Audit of `election_mechanisms` / `election_options` (3 mechanisms corpus-wide):

| Deal | Problems |
|---|---|
| LabCorp / Covance | Both options carry the SAME §2.02 Exchange Fund clause dumped into `cash_per_share_formula` / `stock_per_share_formula`. No per-option economics. `default_treatment: OTHER`. `is_prorated: false` (unverified). |
| QXO / TopBuild | `cash_per_share_formula` holds a proration-cap clause (45% cash / 55% stock caps), not the option's economics ($505.00 cash vs 20.200 Parent Shares). `default_treatment: OTHER` although the quoted text itself says no-election shares "shall be deemed … Stock Elections" → should be `NON_ELECTING_TREATED_AS_STOCK_ELECTION`. |
| IonQ / SkyWater | **False positive.** Its own `verbatim_quote` says "No election shall be made available to any holder … and no proration shall apply" — this is fixed mixed consideration, not an election. Row must be deleted. |
| Beach / Skechers | **Missing entirely** — a genuine cash/stock election deal (Cash Election / Stock Election / No Election Shares machinery in §2) with no mechanism row. |
| UI | `components/review/ElectionCard.jsx` exists, expects exactly the right shape (options[], proration, default, deadline) — and is imported by NOTHING. The review page renders election deals as a flat Consideration table that mixes both options' numbers with no attribution. |

Election-language sweep of CONSID provisions finds exactly **2 true election
deals in the corpus: QXO/TopBuild and Beach/Skechers** (Covance needs manual
confirmation — its mechanism was minted from an Exchange Fund clause, which is
weak evidence). Small N: hand-verifiable, so quality bar is "correct", not
"scalable guess".

## Deliverable (what "done" looks like)

For each true election deal, the review page's Consideration section leads
with an Election block that answers, in order:

1. **The options, by name, as the agreement defines them** — e.g. QXO:
   "Cash Election — $505.00 per share in cash" / "Stock Election — 20.200
   Parent Shares per share". One row per option; `option_label` uses the
   agreement's own defined term ("Cash Election", "Stock Election"),
   `cash_per_share` / `stock_per_share` are NUMBERS (or a short formula
   string when genuinely formulaic), never clause dumps.
2. **Which consideration parts belong to which option** — every
   consideration feature already rendered in the Consideration table
   (per-share cash, exchange ratio, exchange-ratio formula) is attributed to
   its option: `Per-share consideration $505.00 → Cash Election`,
   `Exchange ratio 20.200 → Stock Election`. Un-attributed rows are the bug
   this redo kills.
3. **Default / no-election treatment** from the enum (QXO:
   `NON_ELECTING_TREATED_AS_STOCK_ELECTION`), with the supporting quote.
4. **Proration** — both caps with direction (QXO: cash capped at 45% of
   outstanding shares; stock at 55%, Parent may increase), oversubscription
   treatment, election deadline ref.

## Implementation plan

1. **Extraction fix** (`lib/parser-v2/consideration-equity.js`
   `buildElectionMechanism` + the CONSID extraction prompt): per-option
   fields must be populated from the option's OWN defined-term clause
   ("Cash Election Consideration means…"), not whatever clause the span
   matcher landed on. Add `appliesTo` attribution: each extracted
   consideration feature (perShareCash, exchangeRatio, …) gets an optional
   `electionOption: CASH_ELECTION | STOCK_ELECTION | MIXED | ALL` tag.
2. **Negative guard**: "no election shall be made available" /
   "no proration shall apply" in the candidate span REJECTS the mechanism
   (kills the IonQ false positive class). Election requires affirmative
   holder-choice language ("entitled to elect", "Election Deadline",
   "Form of Election").
3. **Data repair**: delete IonQ row; re-extract QXO + Skechers (+ Covance
   after manual read); re-run `scripts/backfill-elections.js --all` dry-run
   and eyeball every hit before `--apply` (the corpus has only ~2-3 true
   hits — review them ALL).
4. **UI wiring**: render `ElectionCard` in the Consideration section of
   `pages/review/[id].js` when a deal carries an election mechanism; tag
   the existing Consideration table rows with their option
   (`→ Cash Election` pill) using the `appliesTo` attribution.
5. **Gates**: per-option numbers must quote-verify against the document
   (zero flags); `npm test` + eval; live-page check on QXO and Skechers.

Routing note (CLAUDE.md): the option/attribution semantics above are the
Fable-tier part and are now fixed by this spec; steps 1–4 are Codex/Sonnet
implementable against it, with diff review + gates before merge.
