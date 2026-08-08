# UI Asset Sweep — pages/ + components/

Status: IN PROGRESS
Scope: `git ls-files 'pages/**' 'components/**'` (~246 files)
Method: read first 60 lines per file; full read only if relevant; grep to confirm live-mount before calling anything dead.

## Summary

(to fill at end)

## Triage table

Note: `pages/api/**` (79 files, excluding .DS_Store) is entirely IRRELEVANT to this sweep —
every route is a thin handler that either delegates to a `createBroadCorpusContainedHandler`/
`queryContainedHandler` factory in `lib/`, or does a direct Supabase read/write with no
display-side derivation, row enumeration, or absence wording of its own. Listed in one block
rather than one row each, per the "API route plumbing with no domain logic" rule. Two are worth
flagging for the record: `pages/api/admin/processing-flow/metrics.js` is an explicit STUB
(hardcoded placeholder metrics, header says so and code matches), and
`pages/api/trust/report.js` computes quote-verification/coverage stats server-side from stored
data — genuinely a trust/evidence primitive, but no domain logic lives in the route file itself
(delegates out); flagged for lib-slice awareness, not claimed as a UI asset.

IRRELEVANT pages/api/* — thin handler, no domain/display logic (79 files, see note above).

| Path | Verdict | Why it matters now |
|---|---|---|

## Expected rows per family, from the UI's own configs

| Family | Row count | Source file |
|---|---|---|

## Absence / empty-state wordings

| Wording | File | SAFE/UNSAFE | Note |
|---|---|---|---|

## Detailed asset sections

(to fill)
