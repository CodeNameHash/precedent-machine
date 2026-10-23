# Manager handoff, 2026-10-23

Written by the manager session (session_014yr9q51NS76fiRGycShhxz) at Ben's
request for the next manager agent. This is a dated note: evidence and
orientation, not an instruction set. The single executable checklist is
`docs/codex-program/notes/PRODUCT-LAUNCH-IMPLEMENTATION-PLAN-2026-09-04.md`
("the plan"); its findings (1) to (236) are the record, and section 12 is the
manager prompt. Read `docs/core` first (PLAN, OPERATING-RULES, LEGAL-RULES,
CODEBASE-GUIDE), then the plan's findings from (210) on.

## 1. What the product is, in one line

An SEC merger-agreement URL goes in; a lawyer-reviewable set of extracted
facts (one fact per independently operative legal effect, with components and
cited source spans) comes out on the provisions page at
`pages/review/product/[id]/provisions.js`, on the preview deployment
`https://deal-corpus-preview.vercel.app`.

## 2. Where things stand (2026-10-23, 14:30 UTC)

Working, decided, in the default:

- Extraction tier: Claude Sonnet 5.5 at high effort writes the facts; Haiku
  5.5 routes and reads residuals (findings (212), (218); Ben: "Sonnet makes
  sense"). Configs `PRODUCT_ANTHROPIC_API_CALL_KIND_MAP/V4` and
  `PRODUCT_CLAUDE_CLI_CALL_KIND_MAP/V3` in `lib/product/product-model-config.js`.
  The OPUS name keeps the Opus 5.5 configs.
- Request profile DEFAULT: V10 answer, anchored quotes, inline context, the
  all-families cache block on the API (routed families on the CLI), and
  `part_counts: true` (finding (227)): each part of a split section hears its
  fact budget and the sentence count of every limb's opening words.
- Split-section layout: no part of a heading alone; a limb's lead paragraph
  is counted; a thin-answer retry re-runs the thin part only (E's (199e)).
- Ben's three fact shapes (finding (232), work package 26, in the extractor
  instruction with his words): a list of objects under one verb is one fact
  with LIST elements; a proviso that only carves out is an EXCEPTION
  component of its covenant; the opening words' consent standard, time window
  and exception sources are stated once and cited by the limbs as evidence.
  Article qualifiers live on the introduction node once ((207)); the
  provisions page joins them above each representation table by code.
- The comparison matcher (the ladder's numbers): scores a stored fact outside
  the section chapeau, keeps every stored fact's best cover, flags and counts
  BUNDLED where one live fact covers several stored facts (findings (229),
  (230), (233)). The re-score script `scripts/product/re-score-ablation.js`
  rebuilds any job dir's rows.

Evidence of it working:

- NCS whole-agreement confirmation on Sonnet: 931 / 20 / 20 of 971 stored
  facts at about a third of Opus cost, 38% of serial time
  (`docs/codex-program/notes/SONNET-CONFIRMATION-NCS-2026-10-19.md`).
- Eight-section check on the final instruction (job
  pm-ablation-20261022T173641Z, finding (234)): 181 / 5 / 5 of 191; 5.1
  64 / 2 / 0, 8.3 46 / 0 / 0, introductions whole; four of the five
  unmatched are the expected per-section qualifier copies; one real loss on
  3.1 (the MAE proviso on missed projections), to watch on the next deal.

Not done:

- No deal has run end to end on the new stack. The two paused runs (Apogee
  686c3bf2-6d6a-4f53-8c54-c9c2cdcf4225 at 38 of 97; Olaplex
  f1e2493f-8640-42b9-96ef-e4bf9693c967 at 34 of 85) are pinned to the V1
  config (Opus 5, V9 profile) and cannot take the new stack ((235)).
- Ben has not published a first review. Production project
  `tzulhdasmioeechxapdy` has never been written to.
- Four intakes stay QUEUED ((172)); Verve re-intake and the identity gate
  for Crinetics, Centessa and Akero are parked.
- Opus 5.5 medium comparison dropped ((231)); Batch API package to D held
  ((213)) until a deal has run.

## 3. Open decisions, Ben's

1. Apogee: A, a fresh intake on the Sonnet default (recommended), or B, retry
   the old run on the old stack ((235)). Put 2026-10-22 18:10 UTC, no answer
   yet. Steps for A are in section 6.
2. After Apogee is read: Olaplex the same way; then lift the intake pause.
3. Q4 (legacy Query and Compare: retire or keep unrouted) and Q5 (canonical
   limb names for the other eighteen representations, after a few deals).

## 4. How the loop runs

- Manager: this session, `/goal` per plan section 12. Check-ins are
  `mcp__Claude_Code_Remote__send_later` reminders (25 to 60 minutes) that
  fire a stored prompt; read with `ReadNotifications`; re-arm every time.
- Implementers (Claude Code Remote sessions, parent this session):
  A `session_01FcuVU62gzc5H166ZEAXYLP` (extractor instruction, resolver,
  provisions page), E `session_017YHf6843ZUBxd5fKAS1sUg` (cost, ablation
  harness, matcher). B, C, D exist and are idle. Work packages go by
  `mcp__Claude_Code_Remote__create_trigger` with `persistent_session_id` and
  `run_once_at` a few minutes ahead, one concrete task per trigger. A's goal
  text still names an old finding (40); tell it to ignore that. E cannot
  reach the sandbox or use Vercel MCP tools (a permission prompt no one can
  approve blocks it): paste it rows, run its scripts yourself.
- Branches: every manager push goes to both
  `claude/festive-albattani-70cwn5` and
  `codex/product-implementation-plan-20260904`; implementers push to the
  codex branch only. `git fetch`, fast-forward or merge, run the changed
  test files here (the whole `npm run test:active` stalls in this container
  after about 420 tests, finding (222); rely on implementers' full-suite
  lines), push both.
- Findings: numbered in the plan. Manager from (210), now at (236); A from
  (200), at (208); E from (180), at (199h); B (100)s, C (120)s, D (140)s.
  Insert a new manager finding before the line that starts the D block
  ("(140) 2026-10-18 (implementer D), parallel hosted workers").
- Ben's words go into findings and code comments verbatim. No model
  identifiers in commits. No new status documents, authorities, receipts or
  gates. Section 9 checks only.

## 5. Infrastructure

- Vercel project `deal-corpus`, team `team_Zu8dnrxhP3FY0BcfOZtQ4z71`, project
  `prj_pseZ68ISXsxADzNcffHTO2NuGM8b`, alias
  `https://deal-corpus-preview.vercel.app`. Protected by a share cookie:
  `mcp__Vercel__get_access_to_vercel_url` gives a link; `curl -sS -L -c
  <jar> <link>` stores the cookie; links expire in about a day.
- Internal routes take the cookie plus `Authorization: Bearer
  <PRODUCT_INTERNAL_TOKEN>`. The token's value is in the deployment's
  environment and in Ben's hands; it is never in the repository.
- Sandboxes (Vercel named sandboxes): pool `pm-codex-preview-worker` and
  `pm-codex-preview-worker-2` run deals; `pm-codex-preview-worker-3` runs
  ablation jobs. Update any of them to the codex branch head with
  `node scripts/product/update-sandbox-worker.js
  codex/product-implementation-plan-20260904 --name <sandbox>` with
  `VERCEL_TOKEN`, `VERCEL_TEAM_ID`, `VERCEL_PROJECT_ID` exported (values from
  Ben; never written down). All three are at 014ac07 or later.
- Ablation: `POST /api/product/ablation` with `{run_id, sections, variants,
  loops}` returns a job id; `{status: true, job_id}` returns state, log tail
  and the table. Job dirs on the experiments sandbox:
  `/vercel/sandbox/<job>/` (job.log, ablation.md, ablation.json,
  ablation-recording.json, analysis/*.analysis.json). Rungs are in
  `lib/product/cost-ablation.js` (`default_sonnet55` is the default profile
  itself). NCS run id for ablation: `51577c57-41b1-4b75-bcdf-c84ef2558589`.
- Database: Supabase preview branch `ecrtoofsyxozazkvsvcl` (read with the
  MCP `execute_sql`; the credentials never leave the deployment); production
  `tzulhdasmioeechxapdy`, never written.
- Secrets rule: tokens live in shell exports and Vercel env only. Never
  print, log or commit them; never pass the Vercel token as an API key.

## 6. Next steps, in order

1. Get Ben's A or B. For A: `POST /api/product/intake` (cookie and bearer)
   with `{"url":"https://www.sec.gov/Archives/edgar/data/1974640/000114036126025844/ef20076505_ex2-1.htm","idempotencyKey":"apogee-gen3-sonnet-1"}`;
   the response carries the new run id; then `POST
   /api/product/analysis/<run_id>/run` wakes it on a pool sandbox. Watch it
   (the status route, the run's sections in the database), read the facts on
   the provisions page yourself, and record a finding. Watch 3.1's MAE
   proviso and any THIN_ANSWER retries.
2. Olaplex the same way once Apogee reads clean.
3. Ben's first published review on one of them; then lift the intake pause,
   run the four queued intakes, and send D the Batch API package ((213)).
4. Q5 after three deals; Q4 when Ben answers.
5. Production move only on Ben's explicit approval (plan section 11).

## 7. Pitfalls learned

- A run advances under the config it was created with. Changing the default
  does not reach a run in flight; a fresh intake does.
- Never `pkill -f` with a pattern that appears in your own command line.
- The ablation's recorded "new" count differs from a rebuilt one by a few;
  decisions never rest on it (E's (199h)).
- The stored NCS baseline (Opus 5) splits lists and repeats qualifiers per
  section; against it the new cut reads as bundled facts and two unmatched
  per representation section. Expected, not losses ((232), (233)).
- Weekly and five-hour subscription limits stop the implementers and the
  sandboxes together; the sessions' `rate_limit_info` says when they reset.
