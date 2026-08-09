# IOC diagnostic — seven flagged INTERIM_OPERATING cards

Status: IN PROGRESS. Read-only investigation. Reading code via
`git show origin/cursor/step-2x-free-phase-b641:<path>` (branch not checked
out locally).

## Plan
1. Lead hypothesis: lowercasing of held quotes vs open-world quotes (cards
   #470/#471/#472) — locate where lowercasing happens (resolver vs renderer
   vs producer).
2. Corpus-wide count of held claims whose quote is not byte-verbatim in its
   section source.
3. Per-card diagnosis + fix.
4. Corpus counts per IOC reason code, ranked.

## Working log

