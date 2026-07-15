# P8 — Coverage% shortfall investigation: BLOCKED before any deal was reprocessed

**Status: investigation stopped at the pre-flight safety check, per task instructions.
No `reprocess.js --classify-only` command was run against any of the 7 deals.**

## The safety check that failed

Task instructions required verifying, from the script itself, that
`node scripts/reprocess.js --deal "<name>" --classify-only` (no `--apply`) writes
NOTHING before running it corpus-wide. It does not pass that check.

`scripts/reprocess.js` header comment claims:

> DRY-RUN IS THE DEFAULT: prints the plan + section counts, makes zero writes and
> zero LLM calls. `--apply` does the work.

That claim is false for `--classify-only`. Trace of the actual call path:

1. `main()` → `--classify-only` (no `--apply`) → `reclassifyDeal(sb, deal, client, apply=false)`
   (`scripts/reprocess.js:320-351`).
2. `reclassifyDeal` unconditionally calls `classifyFromStoredText(sb, deal, client, prior)`
   at line 328 — **before** the `if (!apply)` early-return at line 342.
3. `classifyFromStoredText` (`scripts/reprocess.js:290-302`) unconditionally calls:
   ```js
   const persistedRegions = await persistParserRegions(sb, deal.id, cleaned, regions, sections);
   ```
   at line 299 — regardless of `apply`.
4. `persistParserRegions` (`lib/parser-v2/region-store.js:133-155`) performs a real
   Supabase write:
   ```js
   const { data, error } = await sb
     .from('parser_regions')
     .upsert(rows, { onConflict: 'deal_id,region_key' })
     .select('id,region_key');
   ```
   This is an unconditional `upsert` into the `parser_regions` table — a write to the
   database — on every `--classify-only` invocation, dry-run or not.

So `--classify-only` without `--apply` is **not** a pure dry-run: it writes to
`parser_regions` (and, if the on-conflict target changed content/keys since the
snapshot, will also change `updated_at`/insert new region rows) before the "apply"
gate is ever checked. Only the `deals.metadata` (`classified_sections`) update at
line 348 — the part someone reading the header comment would assume is "the write"
— is actually gated by `--apply`. The region-store side-effect is not.

A second, related gap: the header also claims "zero LLM calls" in dry-run.
`classifySections` (`lib/parser-v2/classify.js:767-840`) only skips the AI for
sections that resolve deterministically or hit the prior-snapshot cache
(`buildPriorLookup`). Any section whose text changed since the last snapshot (or
that never had one) falls through to `classifyWithAI(batch, articles, client)` —
a real Claude CLI call — with no gate on `apply` either. Whether that fires depends
on how much each deal's stored text has drifted from its cached snapshot; it cannot
be assumed zero.

There is no existing test (`tests/`) covering dry-run purity for
`reprocess.js --classify-only` — this is exactly the kind of regression P4 in the
program plan (`tests/curation-mint-cards.test.js`-style invariant hardening) is
meant to catch, but it hasn't reached `reprocess.js` yet.

**Per the task's explicit instruction ("if it would write, stop and report"), I did
not run the command against M.D.C. Holdings, Forest City Realty Trust, HireRight,
Landos Biopharma, Cox Enterprises, Modiv Industrial, or CSRA.** Running it would
have produced 7 uncommitted-but-real `parser_regions` writes (and possibly live
Claude Max CLI calls) under the label "dry-run," which is the opposite of what the
program's DO-NOT-DO list (#12: no destructive/unreviewed DB write without a backup
artifact; #7: no unbounded reprocess runs) is guarding against.

## What was still safely gathered (read-only: `scripts/ingest-qa.js`, no `--apply`,
   no writes — confirmed read-only from its own header/docs)

Current coverage% per the QA gate (`--min-coverage` default 95):

| Deal | Coverage % | Gate (95%) |
|---|---|---|
| M.D.C. Holdings | 86.0 | FAIL |
| Forest City Realty Trust | 89.7 | FAIL |
| HireRight | 93.0 | FAIL |
| Landos Biopharma | 94.0 | FAIL |
| Cox Enterprises | 90.3 | FAIL |
| Modiv Industrial | 93.9 | FAIL |
| CSRA | 93.8 | FAIL |

That is the only part of the P8 deliverable I could complete safely. The
additive-vs-churn classification diff, card-match impact, human-correction overlap,
and projected post-pass coverage% all require actually running the classify pass —
which is blocked until `reprocess.js`'s dry-run path is fixed to gate
`persistParserRegions` (and any AI fallback) behind `--apply`, the same way the
`deals.metadata` write already is.

## Recommendation (not executed — flagging for main agent / Ben queue)

1. Fix `scripts/reprocess.js` / `classifyFromStoredText` so the region-persist call
   is skipped (or run against a scratch/no-op sink) when `apply` is false. Likely
   fix: thread `apply` into `classifyFromStoredText` and skip
   `persistParserRegions` (pass `{ rows: [], skipped: true }`) when `!apply`, mirroring
   the existing gate on `persistSnapshot`.
2. Add a regression test asserting `parser_regions` row count is unchanged after a
   `--classify-only` dry-run (the exact invariant P4 in the program plan is already
   building for the mint-cards/rematerialize tooling — this is the same class of bug).
3. Once fixed and tested, re-run this investigation (P8) for real on the 7 deals.

## One-line verdicts (required deliverable)

- M.D.C. Holdings — **BLOCKED**: dry-run safety check failed (reprocess.js `--classify-only` writes to `parser_regions` even without `--apply`); not run. Current coverage 86.0%.
- Forest City Realty Trust — **BLOCKED**: same dry-run-purity failure; not run. Current coverage 89.7%.
- HireRight — **BLOCKED**: same dry-run-purity failure; not run. Current coverage 93.0%.
- Landos Biopharma — **BLOCKED**: same dry-run-purity failure; not run. Current coverage 94.0%.
- Cox Enterprises — **BLOCKED**: same dry-run-purity failure; not run. Current coverage 90.3%.
- Modiv Industrial — **BLOCKED**: same dry-run-purity failure; not run. Current coverage 93.9%.
- CSRA — **BLOCKED**: same dry-run-purity failure; not run. Current coverage 93.8%.
