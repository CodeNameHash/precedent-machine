# Model handoff, 2026-09-07

Prepared at Ben's request. This is a transfer note, not a second plan, checklist,
status ledger or source of legal approval. Update progress only in
`docs/codex-program/notes/PRODUCT-LAUNCH-IMPLEMENTATION-PLAN-2026-09-04.md`.

## Start here

Work in `/Users/bengoodchild/precedent-machine-product-plan-20260904` on
`codex/product-implementation-plan-20260904`.
Remote: `https://github.com/CodeNameHash/precedent-machine.git`.

The app's default directory may instead be
`/Users/bengoodchild/precedent-machine-restored-20260812`. That is a different
checkout on an older recovery branch. Do not make current product changes there.
On another machine, clone the repository and select the product branch above.
Do not reset an existing checkout or discard another agent's changes.

Read `CLAUDE.md` and the four live documents it names in `docs/core`, then read
the sole launch plan. Start with its current Phase 5 position, current checklist,
release requirements, sections 7 and 9, and Ben's dated corrections. The long
diagnostic history is evidence, not a queue to execute again.

Ignore superseded lead handoffs and M-stage execution instructions. In
particular, `LEAD-HANDOFF-2026-09-04.md` describes the old programme. Do not
restart Phase 0, promote or rename the sole dated plan, or restore authorities,
registrations, receipts or programme gates. The old example prompt at the end
of the plan is not a reason to restart completed work.

## Where the product stands

Phases 0 to 4 are checked off in the plan, with their stated evidence limits.
Phase 5 is not complete. Phase 6 has not been approved for production cutover.
Successful processing and passing tests do not establish legal accuracy.

The next substantive work is Ben's review of the existing complete NCS draft,
together with comparison against his existing independent Olaplex and Apogee
provision samples on their own agreements. Do not process another agreement
just to have something running. Do not claim those samples accept NCS facts.

The user-facing review is:

[NCS / Weatherford review](https://deal-corpus-git-codex-product-imp-7fe402-codenamehashs-projects.vercel.app/review/product/eaafcac8-790b-41bb-a5e1-b12187a55e7d)

- Run ID: `eaafcac8-790b-41bb-a5e1-b12187a55e7d`.
- Source document ID: `e1414a2d76fe13e31522a75f0fa237c315394ec1b4d5099883696b572e365d80`.
- Source: `https://www.sec.gov/Archives/edgar/data/1692427/000119312526252096/d23867dex21.htm`.
- Parties: Weatherford International plc, Trinity Bell Sub, Inc., and NCS
  Multistage Holdings, Inc. Agreement dated 2026-05-31.
- Ordinary intake completed 104 sections in 118 minutes 26 seconds, without
  manual data repair. This was the final untouched processing candidate.
- Last browser verification on 2026-09-07, after the readability deployment:
  1,039 non-empty proposed-fact cards across 104 sections; 1,672 items awaiting
  review; revision 0; agreement coverage not confirmed. The earlier database
  check recorded no review actions or publication. Recheck before writing,
  since Ben can review independently after this snapshot.
- The display's zero items marked unresolved is a count of review decisions.
  It does not erase the 53 unresolved extraction coverage records. Coverage
  records overlap across levels and are not 53 distinct legal defects.

Do not accept, reject, edit, acknowledge, confirm coverage or publish on Ben's
behalf merely to finish the phase. Prepare source-linked comparisons and exact
questions. Only record legal decisions that Ben has actually made.

## Ben's current directions

- Show one full agreement now and discuss useful excerpts during development.
  Review is due already. Use four distinct agreements as the planning limit;
  Ben said review must occur by four or five at most. Prior runs count. Reruns
  and phase changes do not reset the count. No expansion to ten or forty before
  his review.
- A separate complete lawyer-written inventory is no longer required before
  showing the draft. His independent provision samples replace that requirement,
  not individual acceptance of published facts or review of exceptions.
- More than 90 minutes does not block the supervised internal launch. Keep
  measuring time. Speed work is deferred, not the present task.
- Use known agreements and focused checks for mechanical corrections. Material
  changes to extraction prompts, models, legal distinctions or semantic routing
  still need untouched testing under the plan. Do not relabel such changes as
  mechanical to avoid the rule, or start another deal without addressing his
  review-first instruction.
- Keep phase order unchanged. Do not pursue side work instead of the product.
- Keep authentication and the existing login flow. Do not expose credentials,
  remove login, change a password, or copy sign-in files as part of this handoff.
- Ask only for genuine legal ambiguity, a potentially material compact omission,
  a published absence statement, weaker release requirements, or final production
  cutover approval. Complete safe preparation before the smallest exact question.

The original Olaplex and Apogee notes are partial, independent lawyer input, not
finished assessments or complete inventories. The latest complete Apogee message
supersedes the two interrupted versions. Original notes remain in the private
Manager conversation, not in this public Git handoff. Recover that conversation
before transcribing or assessing an uncertain point. Keep Ben's words separate
from AI additions. Do not invent missing notes, severity decisions or approval.

## Last completed change: review readability

Ben reported that the page appeared to have no proposed facts and showed machine
codes. The facts were present, but the first card was about 35,700 pixels down,
after a large coverage grid. The correction is presentation only:

- Proposed sentences and source links come first, in agreement order.
- A section selector and separate review-check navigation make the page usable.
- Visible category, state, source-kind and diagnostic labels are readable text.
- Coverage remains available under an expandable heading. All findings,
  relationships, exceptions and outstanding counts remain available.
- Structured diagnostic explanations appear as text, with the original record
  behind a closed “Show recorded detail” control.
- No extraction, model, database, legal statement or review decision changed.

Relevant pushed commits, in order:

- `a99516e7360517c111dd71e7ef676d14bf2a6590`: source-linked reference-sample
  evaluation, replacing the separate candidate-inventory requirement.
- `c6d9c0de932019e01f13f3c7fb8f41507259af11`: facts first and readable labels.
- `0b2312b5a39be7a7b77e6969cdd6d1e5297fffb1`: readable source-context kinds.
- `265feb8083ca60f2849a745adbbe31e931dd83c8`: readable diagnostic explanations.

The last code commit above was deployed successfully to the private preview:
`https://deal-corpus-74dpzk2uo-codenamehashs-projects.vercel.app`.
The stable branch URL linked above resolves to that deployment at this snapshot.
Authenticated browser checks found the first card at 595 pixels in a 963-pixel
screen, all 1,039 cards and 104 sections retained, and useful exact source plus
surrounding clause text for Section 5.2. Its source kind reads “Supporting
evidence”. No raw underscore codes remained in recorded diagnostic messages.
The earlier raw JSON explanation was readable, while its full original record
remained under a closed detail control. Coverage remained unconfirmed at revision 0.
The deployment's `/review` route returned the expected 307 login redirect to an
unauthenticated command-line request; actual content was checked signed in.

The complete page is large. Do not export its entire accessibility tree. Use
section-scoped locators, short DOM reads and screenshots. Browser click commands
can time out after the click succeeds; inspect fresh state before retrying.
Do not treat a browser-tool timeout alone as a product failure. All temporary
verification pages and local fixture changes from this correction were removed.

## Code and checks to use

The core guide supplies the source-to-screen map, but parts of its prose still
describe the earlier three-family phase. Current code and the plan include all
25 families and the hosted Codex provider. Do not infer a missing implementation
from that older description.

| Area | Files |
|---|---|
| Review layout and actions | `components/product/ReviewWorkspace.jsx`, `components/product/ProposalCard.jsx`, `lib/product/review-state.js` |
| Readable display and source context | `lib/product/review-labels.js`, `components/product/SourceContextPanel.jsx`, `lib/product/source-context.js` |
| Sample assessment and publication checks | `lib/product/release-evaluation.js`, `supabase/migrations/20260907082337_product_release_reference_samples_v3.sql` |
| Current model selection | `lib/product/product-model-config.js`, `lib/product/codex-cli-model.js`, `lib/llm-cli-client.js` |
| Durable processing and resume | `lib/product/analysis-runner.js`, `lib/product/phase-2-store.js`, `scripts/product-hosted-worker.js`, `lib/product/sandbox-wake.js` |
| Hosted worker launcher | `infra/codex-sandbox-worker/launch.sh` |
| Display regression checks | `tests/product-review-ui-presentation.test.js`, `tests/product-held-issue-ui.test.js`, `tests/product-review-first-load.test.js` |

Run only checks required by section 9 for a change. Do not rerun a passing check
without a relevant change. `npm run test:active` is the active integration suite;
plain `npm test` selects the much larger historical estate too.

For the readability work, affected display, source and held-proposal checks
passed, as did independent code reviews and the actual browser checks above.
The final diagnostic change passed all six held-issue UI tests. One earlier
active-suite run passed 346 of 347 tests and failed an obsolete raw-label
expectation. That expectation was corrected and its affected checks passed.
Do not describe this as a subsequently rerun, fully green 347-test suite.

Separate known limit: the broad Phase 3 database fixture contains only 101 of
109 currently substantive Concho sections. It fails before the reference-sample
change. The focused sample database check passed with current coverage rules,
rollback and reapplication. Do not hide this failure or disable coverage checks
to make the old fixture pass. The plan records the distinction.

No tests or agreement runs are required solely to read this handoff.

## Runtime access, not portable secrets

Source, saved calls, proposals and review history live in the existing private
database, not in Git. The current hosted worker uses a separate ChatGPT sign-in.
Its launcher validates the private database, uses `/vercel/sandbox/pm-cli/bin`,
runs code from `/vercel/sandbox/pm-product`, and checks
`/vercel/.codex/auth.json`. Do not copy or print that file.

The current model map is routing/residual `gpt-5.4-mini` with low reasoning and
extraction `gpt-5.5` with medium reasoning. It uses two section workers. Model
configuration is part of saved run identity. Do not replace it merely because
another model is now available. Older references to a single mini model or
gpt-6-astra are not the current product map.

Use the existing connected services and signed-in browser. Check live worker
state before any restart. No new model call, worker restart or database change
is needed to continue the current lawyer review. Credentials, device codes,
database exports, private source annotations and temporary access links are
intentionally absent from this handoff. On a new machine, access to the private
preview/database must be established separately through the approved sign-in.

Git pushes to the product branch create private Vercel previews. Do not use
`--prod`, promote a deployment or switch production. Before any deployment,
verify the Git author email is Ben's verified address. Preserve existing secrets
and authentication. Verify both deployment status and the actual changed flow.

## People, agents and coordination

Existing visible implementer: **Precedent Machine Phase 5 implementer**, thread
`01a071c6-d2a8-7c80-ba8a-0625af84499c`. Its last slice is complete; it has no
pending write ownership. Its app directory also points to the old checkout, so
always send the correct work directory explicitly.

Use that same implementer unless its context shows drift. Phase handoffs may
use GPT-5.6 Sol at normal reasoning. For bounded work, use the weakest adequate
available model; Luna was used for independent read-only checks. Ben requires
any new implementer to be a visible chat, not only a hidden subagent. Tell every
new implementer the model-cost rule. Never let agents edit the same files.
The previous helper agents are complete, not background workers to wait on.

Private conversation for original instructions and lawyer notes: **Manager**,
thread `01a06e10-2226-7d73-bc6c-12b4f3ef728b`. Read older turns as needed. Do not
depend on its tool-session variables, temporary directories or short-lived tokens.

Deal Storylines coordination remains on `coord/deal-terms`, in
`docs/codex-program/handoffs/deal-terms/`. Read `PROTOCOL.md`, `PINS.md`, the
relevant inbox question and recent outbox before answering. Fetch and rebase
before pushing. Never edit `status/deal-storylines.md` or change the Deal Terms
contract unasked. Do not send credentials or require DS to consume PM internals.

At the fetched coordination tip `2496f3e6`, Q-0006 and Q-0007 have answers.
The Shared Source Core package is pinned to version 1.0.3, package-root commit
`5f2ccafa277202b64231071783973135b9b0c894`. Deal Terms contract 1.2.0 is not a
released legally reviewed Deal Terms data package. Read the pins for exact
consumption commands and conformance data rather than copying them here.
There are already two different Q-0007 outbox filenames numbered A-0018. Do not
reuse that number or silently rewrite either historical answer. The latest is
`A-0018-q0007-replacement-shared-source-core-release.md`; the earlier
`A-0018-q0007-shared-core-node-lookup-fix.md` records Node 22/24 checks.
This is a handoff observation, not permission to reorganise that branch.

## Online checklist and future features

[Online launch checklist](https://precedent-machine-launch-checklist.bengoodchild.chatgpt.site/)
is a read-only view generated from the sole plan, not an independent checklist.
Its separate checkout is
`/Users/bengoodchild/.codex/visualizations/2026/09/04/01a06e10-2226-7d73-bc6c-12b4f3ef728b`.
The source-sync script is `scripts/sync-plan.mjs`; generated data is
`app/plan-data.generated.ts`. Use the Sites building and hosting skills for
changes there. Do not publish its repository through Vercel.

Last published checklist version: 49. Sites project:
`appgprj_6a9b31f8895c81918a3ec4b14f05148b`. Its Git commit is
`f74da56ab32f83d2cef4f96574ec81a0d4eef500`. It includes the readability correction
and the future features in section 7. No checklist change is needed just for
this handoff.

The future-feature list already includes processing/review speed, likely source
precedent identification with clause-level markup reuse, and comparison of exact
covenant wording under common labels. They remain deferred until after external
launch. Do not create another roadmap system or guess which sections are related
to batch them together now.

## Suggested successor prompt

```text
/goal Continue ownership of the Precedent Machine internal product launch.
Work in /Users/bengoodchild/precedent-machine-product-plan-20260904 on
codex/product-implementation-plan-20260904.

Read docs/codex-program/notes/MODEL-HANDOFF-2026-09-07.md and the live documents
it identifies. The sole executable plan and checklist remains
docs/codex-program/notes/PRODUCT-LAUNCH-IMPLEMENTATION-PLAN-2026-09-04.md.
Update that checklist in place. The handoff is context, not a second plan.

Continue from the completed NCS draft in Phase 5. Do not restart phases or
process another agreement before Ben's review. Preserve his review decisions,
the current legal requirements, authentication and source links. Help him review
the full draft and source-linked excerpts, reconcile his existing independent
samples on their own agreements, and fix shared defects with section 9 checks.
Do not substitute agent approval for lawyer review or claim sample accuracy
for a whole agreement.

Reuse the visible Sol implementer where useful. Any new implementer must be a
visible chat. Delegate bounded work to the weakest adequate model and give
every new implementer that instruction. No overlapping file ownership.

Continue through the ordinary submit, process, review, correct, confirm coverage,
publish, reopen and revise flow. No new plans, ledgers, authorities, receipts,
registrations or programme gates. Ask only for the legal decisions or production
approval specified in the plan, after completing safe mechanical preparation.
```
