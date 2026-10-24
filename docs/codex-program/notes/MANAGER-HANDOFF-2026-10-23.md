# Manager handoff, 2026-10-23

Written by the manager session (session_014yr9q51NS76fiRGycShhxz) at Ben's
request for the next manager agent. This is a dated note: evidence and
orientation, not an instruction set. The single executable checklist is
`docs/codex-program/notes/PRODUCT-LAUNCH-IMPLEMENTATION-PLAN-2026-09-04.md`
("the plan"); its findings (1) to (245) are the record, and section 12 is the
manager prompt. Read `docs/core` first (PLAN, OPERATING-RULES, LEGAL-RULES,
CODEBASE-GUIDE), then the plan's findings from (210) on.

## 0. Update, 2026-10-24 08:30 EDT (read this first; sections 2 and 6 below are superseded where they disagree)

Two deals have now run end to end. Findings (237) to (245) carry the evidence.

- **Apogee, Claude (subscription), run 88d4032a**: 97 of 97 sections, 869
  facts, 858 valid, 11 held, ~110 minutes, $0 marginal. READY. This is the
  run to read; it is the first complete deal on the current stack.
- **Apogee, DeepSeek, run 34847358**: 97 of 97 sections, 874 facts, **758
  valid, 116 held (13.3 per cent against Claude's 1.3)**, $18.02, ~45
  minutes, READY after four finalisation attempts. Losses are uneven: 41 of
  92 sections produced fewer valid facts (5.3 no-shop 54 to 42, 5.5
  antitrust 33 to 24, 3.13 40 to 32, 7.3 20 to 13), and **5.16 produced
  nothing at all** where Claude found six regulator-notice covenants — an
  empty answer the thin-answer guard did not catch. Verdict (finding (245)):
  do not switch the default; DeepSeek is ~2x cheaper at list, not 4x (its
  cache does not behave as Anthropic's; 22.4M input tokens against Claude's
  14.1M), and its citation discipline is an order of magnitude weaker. The
  tier stays available as provider `DEEPSEEK_API` for further trials, the
  flash tier untested end to end.
- **Olaplex run ab1cf03b** is paused at 27 of 87: its worker was stopped
  cleanly to protect the last of the Claude weekly allowance, the section
  was released with its calls recorded, and it resumes on a wake. Its status
  still reads RUNNING with no worker — stale, harmless, and the same stale
  state as the old Apogee run 686c3bf2. Run f1e2493f is NOT Olaplex; it is
  Gilead Sciences / Arcellx (finding (238)).
- **The DeepSeek provider exists** (work package 31, merged 2a361963):
  provider id `DEEPSEEK_API`, base URL `https://api.deepseek.com/anthropic`
  (an Anthropic Messages endpoint, verified live), ROUTING and RESIDUAL on
  `deepseek-flash` at effort low, EXTRACTION on `deepseek-v4-pro` at effort
  high, key `DEEPSEEK_API_KEY` on the deployment and passed through the wake,
  prices from the published table. Two parser defects it found are fixed: the
  response contract offers residual dispositions and coverage states as JSON
  lists meaning "one of", and DeepSeek returns a one-element list, which
  failed as `RESIDUAL_DISPOSITION: KNOWN_FAMILY` and `COVERAGE_STATE:
  1.6:MERGER_STRUCTURE_CLOSING` (1e950348, d8b6bab7). Any future provider
  that reads the contract literally meets the same wall; the durable fix is
  to render those contracts as "one of: A | B | C" strings rather than arrays.
- **The lawyer preview page is fast** (work package 32, ce1def4b, c31c9a7f,
  dd44090b): 45.7 MB and 45 to 59 s before, 3.9 MB and 16 s after, reloads
  instant, rendered HTML byte-identical. What remains is the database
  scanning a 97-section run's rows (31 sections take 8 s; a light query 0.7
  s), so the next cure is a server-side read model or a bigger instance, a
  cost decision for Ben.
- **Closing conditions are two tables by side** (work package 30, d6c4125a),
  per Ben's finding (243): "Conditions to the Company's Obligations" and
  "Conditions to Parent's Obligations", the side read from each fact's own
  words, and the 5.9 filing negative its own row.
- **Now open, in order**: (a) the thin-answer guard does not catch a section
  that returns no facts at all — a silent absence a lawyer would read as
  "this agreement has no such provision", and it affects Claude too; (b)
  draft finalisation fails intermittently on the preview database (four
  attempts for DeepSeek, two for Apogee, both eventually READY, and neither
  blocks the read) — a run that has finalised must not fall back to FAILED,
  and the finalise should be batched or resumable; (c) 19 valid facts carry
  no headline summary because a summary over 18 words is dropped rather than
  shortened; (d) the work packages from the Apogee read: 28 the caps
  (finding (239)), 29 a cross-reference to a limb resolving so a whole fact
  is never lost to one reference (the Company's breach termination right),
  31 the empty-summary fix; (e) the 5.3 "multiple period literals" held fact.
- **Operational lessons from this session**: two agents must not share one
  git working tree — a subagent's `git checkout` landed the manager's commits
  on the other branch and a reported "pushed" was false until it was caught;
  use `git worktree add` with a symlinked `node_modules` (the pattern used
  for wp31 and wp32). A codex-branch push did not always trigger a Vercel
  build while the festive-branch one did; an empty commit forces it. The
  preview database is slow enough that concurrent heavy reads cause
  `canceling statement due to lock timeout` on run writes.
- The manager session that wrote this update ran on a DeepSeek-backed agent
  with DSH subagents, not the Claude Code Remote implementer sessions A to E
  described in section 4, and drove the deployment with plain curl and a
  Vercel token. The A/E sessions were left idle deliberately: Claude
  allowance is the scarce resource (it reached about 5 per cent of the weekly
  limit on 2026-10-23, which is why Olaplex was paused and why work package
  31 was built at all). Section 4's mechanics still describe the Claude Code
  Remote loop and remain valid for a session that has those tools; this one
  did not, and used `git worktree` plus subagents instead.

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

Superseded by section 0 (2026-10-24): a deal HAS now run end to end, twice.

- Apogee ran fresh on the Sonnet default (88d4032a, READY) and again on
  DeepSeek (34847358, READY) — see section 0 and findings (241) and (245).
- The two old paused runs are history: 686c3bf2 (Apogee, 38 of 97) and
  f1e2493f (Gilead/Arcellx, 34 of 85 — mislabelled Olaplex in (235)).
- Still true: Ben has not published a first review; production project
  `tzulhdasmioeechxapdy` has never been written to; four intakes stay QUEUED
  ((172)); Verve re-intake and the identity gate for Crinetics, Centessa and
  Akero are parked; the Opus 5.5 medium comparison is dropped ((231)); the
  Batch API package to D is held ((213)).

## 3. Open decisions, Ben's

Answered since this note was written:

1. Apogee: Ben chose A on 2026-10-23 ("1. A"), on the Claude subscription
   ("3. use the claude subscription"), and agreed the deals run sequentially
   ("sequential - I agree"). Both are done: Apogee ran on Claude and on
   DeepSeek (findings (238), (241), (245)).
2. Still open, now narrower: whether to spend on a bigger preview database
   or build the preview read model (section 0); whether to harden the
   quoting instruction and retry DeepSeek, and at which tier; whether to
   batch or make resumable the draft finalise.
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
- Added 2026-10-24: provider `DEEPSEEK_API` on the deployment (key
  `DEEPSEEK_API_KEY`, set in the Vercel project environment), base URL
  `https://api.deepseek.com/anthropic`. It is chosen per run with the
  intake's `provider` field; it is not the default.
- How this session reached the preview without the Vercel MCP: the project's
  Deployment Protection bypass secret, sent as
  `x-vercel-protection-bypass`, plus `Authorization: Bearer
  <PRODUCT_INTERNAL_TOKEN>` on the internal routes. Plain curl is enough;
  no MCP tools were available. The manager held, in 600 files under `/tmp`
  and never in the repository, the bypass secret, the internal token, a
  Vercel API token (sandbox updates and deployment state) and the DeepSeek
  key. Those files do not survive a reboot: a new session must ask Ben for
  the bypass secret and the internal token again. GitHub pushes worked from
  the already-cached osxkeychain credential once Ben had pushed once.

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
- Two agents must not share one git working tree. On 2026-10-23 a subagent's
  `git checkout` moved HEAD while the manager committed, so two plan commits
  landed on the other branch and a "pushed" the manager reported was false
  until it was noticed. Give an agent its own `git worktree` with a symlinked
  `node_modules` (the pattern used for work packages 31 and 32), and check
  `git branch --show-current` before committing.
- A codex-branch push did not always start a Vercel build while the
  festive-branch push did. An empty commit forces one.
- DeepSeek (and any model that reads a contract literally) returns a
  one-element JSON list where the contract prints a list of allowed values
  meaning "one of". Parser fixes bought it, but the durable fix is to render
  those contracts as strings ("one of: A | B | C").
- The preview database is slow: a light query 0.7 s, a 97-section preview
  read 16 s, and concurrent heavy reads cause `canceling statement due to
  lock timeout` on a run's writes. Do not poll a big read while a run is
  finalising.
- Never `pkill -f` with a pattern that appears in your own command line.
- The ablation's recorded "new" count differs from a rebuilt one by a few;
  decisions never rest on it (E's (199h)).
- The stored NCS baseline (Opus 5) splits lists and repeats qualifiers per
  section; against it the new cut reads as bundled facts and two unmatched
  per representation section. Expected, not losses ((232), (233)).
- Weekly and five-hour subscription limits stop the implementers and the
  sandboxes together; the sessions' `rate_limit_info` says when they reset.
