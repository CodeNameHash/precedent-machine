# The plan to merge to main

Written 2026-08-05 as step D1 of `ROADMAP.md`. Pinned to branch
`codex/m3-production-phase1` at commit `c9da72266771bd4b24140456b26a96bed56da7a5`
(2026-08-05 15:30, "docs: record decision 1, open site risk accepted"). The
branch is under active edit by other agents while this document is being
written; anything committed after that SHA is not covered here. Before
executing, re-run the commands in Part 5's "keeping this current" note
against whatever the branch's tip is by then.

This is an assessment and a plan, not a merge. No commit, push, reset,
rebase, or branch switch happened while writing it. `ROADMAP.md` records why
this step exists and blocks step D2; `OPERATING-RULES.md` holds the
authority boundary. Nothing here grants authority to merge; that is a
decision for a person.

---

## How to read this

Every part has two sections, in this order:

1. **What it is.** Plain English. If you only want to know what would ship
   and how risky it is, read only these.
2. **Technical.** File paths, exact commit hashes, exact commands, and the
   evidence behind each claim, for whoever executes this.

---

## Part 1. What you would actually be shipping

**What it is.** Two hundred and ninety commits, written over five days
(2026-08-01 through tonight), split cleanly into two kinds of work.

The first kind, the great majority of it, is a new extraction and data
system, Canonical V2, being built alongside the one that actually serves the
product today. It lives almost entirely under `lib/canonical-v2/` and its
tests and fixtures. None of it is wired to run in production: it is
switched off by an environment check that explicitly excludes Vercel
production deployments, verified by reading the check itself, not by taking
the branch's word for it (Part 2 below).

The second kind is small, real, and touches the page a person is looking at
today: the review page and its side-by-side deal comparison. Eighteen of the
two hundred and ninety commits touch a file on that path. Most of those
eighteen add new gated content that stays invisible in production. A
smaller number, concentrated in tonight's last few commits, are genuine,
unconditional fixes to what a user sees right now. Part 2 names them
individually.

Two smaller threads run alongside: a large one-time capture of real model
output that was about to be lost (a single commit, 146,000 lines, entirely
JSON evidence data, zero code), and a repo-wide documentation reorganisation
that moved roughly fifty files into `docs/archive/` (this is also what
breaks the CI phase check; see Part 4).

**Technical.**

- Merge base: `05d9cc220ad1cfd8393640b6b756403bd2c21b8c`.
- `main..codex/m3-production-phase1`: 290 commits.
- `codex/m3-production-phase1..main`: 0 commits (see Part 3).
- Diff `main...codex/m3-production-phase1`: 912 files changed, 314,982
  insertions, 9,825 deletions.

Commit subjects by conventional-commit scope (290 total; the 18 without a
`type(scope):` prefix are the M3-family-adapter integration wave and five
`Merge remote-tracking branch 'origin/main'` housekeeping commits absorbed
earlier in the branch's life, which is mechanically why main is a strict
ancestor today rather than a diverged branch):

| Scope | Commits |
|---|---:|
| feat(canonical-v2) | 87 |
| fix(canonical-v2) | 63 |
| test(canonical-v2) | 20 |
| fix(demo) | 7 |
| fix(reprocess) | 5 |
| fix(m3) | 4 |
| audit(canonical-v2) | 4 |
| feat(programme) | 3 |
| feat(demo) | 3 |
| fix(programme) | 2 |
| chore(canonical-v2) | 2 |
| fix(review), fix(query), fix(backfill), feat(taxonomy), feat(reprocess), chore(schema), chore(programme), chore(process-intelligence) | 1 each |
| no scope prefix (M3 adapter wave, main-merges) | 18 |

Files changed by top-level directory:

| Directory | Files |
|---|---:|
| tests/ | 382 |
| lib/ | 295 |
| docs/ | 121 |
| scripts/ | 54 |
| components/ | 21 |
| evidence/ | 14 |
| pages/ | 11 |
| __fixtures__/ | 6 |
| .github/ | 3 |
| supabase/ | 2 |
| sql/, PLAN.md, .vercelignore | 1 each |

`lib/` broken down (295 total): 217 under `lib/canonical-v2/`, 17
`lib/query/` (search), 10 `lib/parser-v2/` (ingestion), 9
`lib/programme-gates/` (governance bookkeeping), 8 `lib/review-parity/`
(a dev harness), 5 `lib/queries/` (the live review-page data path, see Part
2), 4 `lib/corrections/`, 3 each `lib/row-market-stats/` and
`lib/market-metrics/`, 2 each `lib/schema-shape/`, `lib/schema/`,
`lib/reports/`, and 13 single files.

`package.json`, `package-lock.json`, `next.config.js`, and `vercel.json` are
byte-identical between `main` and the branch. No new dependency, build
setting, or platform config risk from this merge.

---

## Part 2. Where the real risk actually is

**What it is.** Three independent facts, each verified by reading the
actual code rather than trusting a comment, establish that almost none of
the 912 files can affect a live user:

1. Every Canonical V2 code path that could touch a served page is gated by
   `isPermittedCanonicalV2Runtime()` (`lib/canonical-v2/feature-flags.js`),
   which returns `false` outright whenever `VERCEL_ENV === 'production'`.
   That is a platform-stamped variable, not something a request can spoof.
2. `lib/service-client-route-actions.js`, the file that hard-contains every
   mutation route and enforces the "eighteen temporarily-unavailable
   responses" ROADMAP.md describes, is not touched by a single one of the
   290 commits. Whatever is contained on `main` today stays contained after
   this merge, mechanically.
3. `pages/api/market-stats.js`, `pages/api/corpus-stats.js`,
   `pages/api/corpus-stats-batch.js`, and `pages/api/ingest/from-url.js` are
   still thin stubs delegating to `marketStatsContainedHandler` /
   `createBroadCorpusContainedHandler` on the branch, exactly as on `main`.

Given that, the real question is not "what changed" but "what changed on a
file that runs regardless of any flag." That set is small. Read every one
of the files below; everything else in the 912 is either non-runtime
(tests, docs, evidence, scripts) or provably gated.

**Tier A: unconditional changes to what the live page shows today.** These
deserve line-by-line review, not a skim.

| File | What changed | Why it matters |
|---|---|---|
| `lib/queries/review-deal.js`, `lib/queries/claims-adapter.js` | `normalizeCard()` now resolves a card's claims through `claimsForCard()`, which narrows the shared `excerpt_id` bucket to the card's own `provision_instance_id` instead of handing every claim on that excerpt to every card that shares it. Also fixes `sortKey()` treating a `null` offset as `0` (sorts first) rather than "unknown" (sorts last). | This runs for every card, on every deal, on every review-page load, with no flag. The comment dates it "2026-08-05 ruling" and states both live claim-writers already stamp `provision_instance_id` correctly; that is an operational claim about production data this assessment cannot verify without a database query. The fallback is safe (a card or claim without the new column behaves exactly as before), so the worst case is "no change," not "wrong data," but confirm the precondition (see Part 6, item 11). |
| `components/review/table-configs/termination-fees.config.js` | `isTerminationFee()` now excludes a card if `isClaimedByAnotherFamily(card)` is true, before falling back to its regex match. | Real, documented bug (a buyer-financing rep card was leaking into the termination-fee table). Fixes it for every deal, unconditionally. Correct fix, but it changes rendered output for real, already-ingested deals. |
| `components/review-v2/CompareColumn.jsx` | Three named bug fixes: (1) representations-qualifiers general-exceptions/knowledge-summary rows rendered a bare "-" in compare mode, now show the real sub-facts; (2) MAE Company/Parent rows collided with no divider, now separated by "Company MAE" / "Parent MAE" bands; (3) the "N of M present" coverage footer (conditions, material-contracts) was silently dropped in compare mode, including for the primary deal, now restored. Also a new filter dropping any row with `comparisonState === 'NOT_ADMITTED'`. | This is the side-by-side comparison feature, confirmed live on `main` today (see below). All three are real data that was being hidden; the fix is additive/corrective, not a redesign, but it changes what a user sees the next time they open compare mode. |
| `components/review-v2/MaeSection.jsx` | The "Disproportionate carveback" pill changes from a Yes/No binary to Yes/"Not established" (a proven negative can no longer be shown; the honest state when nothing proves the carveback either way is now named as such). Carve-out item dedup key changed to prefer `claim_revision_id`/`closure_id`/`limb_identity` when present, falling back to the old name-based key otherwise. | Unconditional text change on every MAE section, single-deal and compare. Legally meaningful (asserting "No" versus "not established" are different claims); worth a native-English proofread on the deployed page, not just a code review. |
| `components/review-v2/compareRowUnion.js` | The "No conflict; consents & approvals" row-family grouping changed from code `REP-T-CONSENT` to `REP-T-GOVAPPROVAL`, following a same-day V1 reclassification. | Only affects the row-family label under which compare mode groups rows across deals. If any already-ingested card still carries the retired `REP-T-CONSENT` code (not yet relabelled in the database), that card's row silently stops joining this family in compare view. Cannot be confirmed without a database query (Part 6, item 11). |
| `components/review/table-configs/conditions.config.js`, `representations-qualifiers.config.js` | "Isolate representation bring-down sides" (commit `142999f0`): changes how bring-down data is scoped per party. | Direct fix to the live V1 rendering path, not V2-gated. |

**Tier B: unconditional, additive rendering.** New real fields surfaced on
the live review page for the first time, by design (this is what
ROADMAP.md's "73 finished, not displayed" blockers refers to). No data
mutation, no gating, just more content:

`antitrust-regulatory.config.js`, `sec-meeting.config.js`,
`votes-approvals-meeting.config.js`, `misc-boilerplate.config.js`,
`termination-rights.config.js`, `mae-definitions.config.js`,
`employee-benefits.config.js`, `tail-fee.config.js`. Lower risk than Tier A
(nothing here can misattribute or hide existing data, it only adds new
rows/columns) but still worth a visual pass since it changes page layout
for those families.

**Tier C: server-gated, read-only, provably inert on production data
today.** `material-contracts.config.js`, `general-covenants.config.js`,
`no-other-reps-fraud.config.js`, `representations-qualifiers.config.js` (the
preview-lane portion) route their Canonical V2 content through a new shared
module, `components/review/table-configs/canonical-v2-preview-lane.js`. It
is worth naming why this one is trustworthy rather than merely asserting it:
the lane only renders when `reviewDeal.canonical_v2_preview_enabled` is an
**own property holding the exact boolean `true`** (fails closed on missing,
falsy, or spoofed-truthy values); it is read-only by construction, its
render context strips every mutation handler regardless of what a caller
passes in; and `components/review/ProvisionTable.jsx`'s own inline comment
states the split "is a pure no-op whenever no row carries the dark-preview
market state, which is every reviewDeal the live product builds today." This
assessment traced that chain into `pages/api/review/[id]/cards.js`, which
calls the two functions that would attach such a row
(`attachCanonicalV2Preview`, `attachCanonicalTerminationFeeServing`), both of
which return the input object unchanged when their gate is off, and into
`lib/queries/review-deal-wire.js`, which only forwards the new wire fields
when they are already present as an own property. Every link fails closed.
This is careful work; treat it as reviewed, not as trusted on faith.

**Tier D: dead code removed.** `pages/compare.js` (2,414 lines) and
`pages/api/compare.js` are deleted. Confirmed by grepping the entire
`components/` and `pages/` tree on `main` for any link to `/compare`: there
is none. The live compare feature is the `?compare=<id>` query parameter on
`/review/[id]` itself (unchanged file, already wired to
`components/review-v2/*` on `main`), not the standalone page. This is
cleanup of an already-orphaned route, not a live feature removal. Residual
risk: an external bookmark or stale search-engine link would now 404 instead
of loading a stale page; that is a strict improvement, not a regression,
since a stale unlinked page serving stale data is worse.

**Tier E: comment or doc-path fixes only, zero functional change.** One-line
diffs correcting `docs/handoffs/...` references to `docs/archive/handoffs/...`
after the documentation move: `components/DealsTable.js`,
`components/review-v2/SourceOverlay.jsx`, `pages/api/provisions.js`,
`pages/admin/registry/reconcile.js`, `pages/api/admin/reconcile/decide.js`,
`pages/api/corrections/review.js`, `pages/corrections-review.js`,
`sql/optionA/README.md`, `PLAN.md`. Read each diff to confirm; all nine were
read for this assessment and each is exactly a comment or string literal.

**Tier F: cleanup on an already-gated-off surface.** `pages/query/[kind]/[id].js`
retires the `DEAL_COMPARE` and `DEAL_TO_MARKET` query kinds, both of which
already just redirected to the review page's own compare mode. Search is
switched off in production per ROADMAP.md 2.2, so this page's own behaviour
is not independently reachable regardless.

**Tier G: new pages, gated closed by their own route guard.**
`pages/design/programme-decisions.js` calls
`designPreviewServerSideProps()` (`lib/design/route-guard.js`), which
returns `{ notFound: true }` whenever `NODE_ENV === 'production'` unless an
explicit `ENABLE_DESIGN_PREVIEW=1` override is set. `pages/demo/four-deal.js`
has no inbound link anywhere in `components/` or `pages/` on `main`
(confirmed by grep); it is a directly-navigated internal tool, not part of
the product's own navigation.

**Everything else (roughly 880 of the 912 files): non-runtime or gated by
the checks above.** `tests/` (382), `docs/` (121), `evidence/` (14, one
commit alone is a 146,000-line JSON data capture with zero code),
`scripts/` (54, operator-run, not invoked by any live route),
`__fixtures__/` (6), and the remainder of `lib/canonical-v2/`,
`lib/query/`, `lib/parser-v2/`, `lib/programme-gates/`, `lib/review-parity/`,
`lib/row-market-stats/`, `lib/market-metrics/`. Two `supabase/*.sql` files
change (an additive, backward-compatible enum widening on `run_reports.kind`
plus a comment fix); these are hand-run reference schema files, not an
auto-applied migration, so merging the code does not itself touch the live
database; the only consequence of not running the SQL is that one offline
script (`v1-reclass-apply` reporting) would fail its own report insert,
which no user-facing route depends on.

---

## Part 3. Has main moved

**What it is.** No. Zero commits on `main` are missing from this branch.
`main` is a strict ancestor of `codex/m3-production-phase1`, meaning every
commit on `main` is already contained in this branch's history. A trial
merge proves there is nothing to reconcile: git's own answer was "Already up
to date," which is only possible when there is no divergence to merge at
all. This is the least risky fact in this entire assessment: there is no
scenario, under this specific merge, in which a textual conflict occurs.

**Technical.**

```
git merge-base main codex/m3-production-phase1
  -> 05d9cc220ad1cfd8393640b6b756403bd2c21b8c

git rev-list --count codex/m3-production-phase1..main
  -> 0

git merge-base --is-ancestor main codex/m3-production-phase1 && echo yes
  -> yes

git merge --no-commit --no-ff main   (while on codex/m3-production-phase1)
  -> Already up to date.
```

No `.git/MERGE_HEAD` was created (confirmed by direct check), so there was
nothing to `git merge --abort`; the working tree and `HEAD` were unchanged
by the attempt (`HEAD` before and after: `c9da72266771bd4b24140456b26a96bed56da7a5`).
The current branch was verified as `codex/m3-production-phase1` before and
after every command in this assessment.

One honest caveat: at the time of this trial merge, the working tree carried
uncommitted changes from other agents actively editing
`components/review/table-configs/` and `docs/codex-program/`, exactly as
this assessment's brief warned. Those files were not touched, staged, or
reverted. They are not part of this analysis; anything they represent will
show up as new commits on the branch after this document is written, and
needs to be classified with the same method before being folded into a
slice (see Part 5's "keeping this current").

---

## Part 4. The CI position

**What it is.** `.github/workflows/ci.yml` is byte-identical between `main`
and this branch, so merging changes nothing about what CI checks, only what
it checks against. Two jobs are unconditional and matter most:
`test-and-build` (`npm test`, then `npm run build`) and `invariants` (eleven
scripts, one of which is a duplicate label for `test-and-build` itself, so
ten real checks). Both run on every push to `main` and on every pull
request. Three more jobs (`schema-parity`, `demo-set`, `demo-dryrun`) run
only on pull requests and cleanly skip themselves when the files they care
about are not in the diff, or fail open (`continue-on-error: true`) for
`demo-dryrun` specifically.

The sixth job, `phase-allowlist`, runs only on pull requests and will fail
on a PR opened directly from `codex/m3-production-phase1`. The brief for
this assessment described the mechanism as reading the committed
`.phase-id` file. That is not quite what happens, and the real mechanism
matters for the fix:

The job determines the "active phase" from the **pull request's source
branch name**, via `scripts/ci/detect-phase.js`, which reads
`GITHUB_HEAD_REF` (set automatically by GitHub Actions to the PR's head
branch), not the committed `.phase-id` file. That file is a side effect the
script writes locally when it runs; on `main` and on this branch it
currently holds `WP-PROGRAMME-SUCCESSOR-PUBLICATION-V2`, a leftover from
whichever branch merged last, not a live input to future checks.

Branch names must match one of: `phase-{N}/*`, `wp/<slug>`,
`plan/land-plan-system`, or two hardcoded infra branch names.
`codex/m3-production-phase1` matches none of them. `detectPhaseDetails()`
throws `Branch name must match phase-{N}/*, wp/<slug>, plan/land-plan-system,
or a hardcoded WP-CI-INFRA-* branch, got "codex/m3-production-phase1"`, the
step exits 1, and the job fails at phase **detection**, before the allowlist
is even consulted. This is a harder failure than "wrong allowlist": it is
"no phase resolves at all."

Separately, and worth knowing even though it is not the operative failure:
if the phase somehow did resolve to the committed `.phase-id` value, that
phase's own allowlist
(`.github/phase-allowlists/wp-programme-successor-publication-v2.json`)
**explicitly denies `components/**` and `pages/**` by name**, on top of not
allowing `lib/canonical-v2/**`, `tests/**`, `docs/**`, `evidence/**`, or
`scripts/**` at all. Either way this PR does not pass as opened.

**Is the allowlist self-amendable? Yes, and this is not a new mechanism
invented for this assessment.** The repository already contains roughly 300
files under `.github/phase-allowlists/`, each authored in the same PR as the
work package it scopes, each named for the `wp/<slug>` (or `phase-{N}/`)
branch that introduced it. This exact "open a correctly-named branch, add
one allowlist file scoping exactly what you are about to touch, in the same
PR" pattern is how every one of those roughly 300 prior phases already
merged. It is a proven, working piece of process, not a barrier invented
against this merge specifically.

**What the minimal honest fix is, and what it is not.** The honest fix is
to give each merge slice (Part 5) its own correctly-named `wp/<slug>`
branch and its own allowlist file, generated from that slice's actual
`git diff --name-only`, not hand-typed and not "allow everything." A single
allowlist covering all 912 paths in one file would technically satisfy the
script, but it would not be scoping anything: an allowlist the size of the
entire diff is functionally equivalent to deleting the check, just spelled
differently. This assessment explicitly rejects that option. The per-slice
allowlists in Part 5 use directory-prefix globs (`lib/canonical-v2/**`,
`tests/**`, and so on) matched against what each slice actually contains,
the same granularity the existing ~300 precedent files use, which keeps the
check meaningful rather than decorative.

**One fact that changes the urgency, not the recommendation.** `main` has
no branch protection rule and no ruleset configured (`gh api
repos/:owner/:repo/branches/main/protection` returns `404 Branch not
protected`; `gh api repos/:owner/:repo/rulesets` returns `[]`). No GitHub
setting technically blocks a merge on a red `phase-allowlist` check; nothing
requires this check to pass before the merge button is clickable. That
lowers the odds this is a hard blocker on execution day, but it does not
change the recommendation: fix it properly, per slice, for the same reason
CLAUDE.md gives for not skipping gates generally, a red check that gets
merged past once becomes normal to merge past. It is also worth flagging to
Ben separately, outside this merge, that `main` itself carries no
protection at all; nothing in this task asked for that to be fixed, so it
was not.

---

## Part 5. The plan: how to slice it

**What it is.** A single 912-file, 290-commit pull request is not
reviewable, but it is also not obviously the wrong call: this assessment
checked whether the eighteen commits that touch a live file (Part 2) could
be cleanly pulled out into their own small pull request, separate from the
inert canonical-v2/test/doc buildout. They cannot, not without cherry-picking
individual commits out of their original order: fourteen of the eighteen
are scattered through the middle of the branch's history (positions 48 to
141 of 290), interleaved with unrelated canonical-v2 commits, not
contiguous. Reordering 141 commits that were never tested in that order is
a worse risk than the one it would remove: every one of these commits has
only ever been built and (per CI) tested in the sequence it already has.

So this plan does not cherry-pick. It slices by time, along the branch's own
existing, untouched commit sequence, at the one real seam in it: a
19-hour-plus gap between the end of a dense, continuous five-day build and
the start of tonight's integration session. Two slices, each a contiguous
range of the original commits in their original order, each mechanically
guaranteed conflict-free against `main` for the same reason the whole branch
is (Part 3).

**Slice 1, "the foundation."** `main` through `0d17ad0085a2a6b365448637d9dbdccb6d20871c`
(2026-08-04 15:48, "feat(canonical-v2): add Phase 1 production-readiness
controls"). 282 commits, 654 files, 126,267 insertions, 6,285 deletions.
Almost entirely the canonical-v2 buildout, its tests, its fixtures, and
documentation, all gated per Part 2. Contains fourteen commits that touch a
live file, listed below; two of those (marked) are not canonical-v2-gated
and deserve individual reading before merging this slice.

**Slice 2, "tonight's integration and live fixes."**
`0d17ad0085a2a6b365448637d9dbdccb6d20871c` through
`c9da72266771bd4b24140456b26a96bed56da7a5`. 8 commits, 414 files, 190,260
insertions, 5,085 deletions (the size is almost entirely one 146,000-line
data-only commit; the code content is much smaller than the line count
suggests). Contains the concentrated, highest-scrutiny changes: the
`provision_instance_id` claims fix, the termination-fee card-attribution
fix, all three compare-mode bug fixes, the MAE pill relabel, and the
documentation archive move that trips the phase-allowlist check. This slice
gets full line-by-line review, not spot checks, and is the one Part 6's
live-site verification is written against.

| | Slice 1 | Slice 2 |
|---|---|---|
| Range | `main..0d17ad0085` | `0d17ad0085..c9da722667` |
| Commits | 282 | 8 |
| Files | 654 | 414 |
| What could break | A live file gets a wrong value from the fourteen flagged commits | The provision_instance_id fix mis-scopes claims if the data precondition is false; the termination-fee, compare-mode, or MAE changes render wrong for a real deal |
| How you would know | Part 6 checklist, items 2, 3, 7 | Part 6 checklist, all items, especially 4, 5, 6, 7, 11 |
| Rollback | `git revert -m 1 <slice-1-merge-sha>` on `main`, push | `git revert -m 1 <slice-2-merge-sha>` on `main`, push |

**Technical.**

Both slices merge with an explicit merge commit (`--no-ff`), never a
fast-forward or squash, specifically so each slice has exactly one commit on
`main` to revert if something goes wrong. Preserving the original 290
commits' authorship and messages inside those merge commits is also the
point: none of the history is rewritten, so `git blame` and `git log`
against `main` keep telling the truth after this lands.

*Slice 1 setup.*

```
git fetch origin
git checkout -b wp/m3-canonical-v2-foundation 0d17ad0085a2a6b365448637d9dbdccb6d20871c
```

Add `.github/phase-allowlists/wp-m3-canonical-v2-foundation.json`:

```json
{
  "phase": "WP-M3-CANONICAL-V2-FOUNDATION",
  "required_work_class": "implementation",
  "allowed": [
    ".phase-id",
    ".phase-raw-id",
    ".github/phase-allowlists/wp-m3-canonical-v2-foundation.json",
    "lib/canonical-v2/**",
    "lib/programme-gates/**",
    "lib/query/**",
    "lib/parser-v2/**",
    "lib/schema/**",
    "lib/market-metrics/**",
    "lib/row-market-stats/**",
    "lib/rubric.js",
    "lib/programme-decision-console.js",
    "lib/llm-cli-client.js",
    "lib/four-deal-local-demo.js",
    "lib/four-deal-local-demo-preview.js",
    "lib/category-summary-features.js",
    "lib/canonical-conditions.js",
    "lib/abry.js",
    "components/review-v2/compareRowUnion.js",
    "components/review/table-configs/*.config.js",
    "pages/demo/four-deal.js",
    "pages/design/programme-decisions.js",
    "tests/**",
    "docs/**",
    "scripts/**",
    "evidence/**",
    "__fixtures__/**"
  ],
  "denied": [
    ".env*",
    "sql/**",
    "supabase/**"
  ],
  "note": "The canonical-v2 buildout. Fourteen commits in this slice touch a table-config or compareRowUnion.js with a real V1-facing change; see MERGE-PLAN.md Part 5 for the exact list. Everything else here is gated behind isPermittedCanonicalV2Runtime or is non-runtime."
}
```

Then: `git add .github/phase-allowlists/wp-m3-canonical-v2-foundation.json`,
commit, `git push -u origin wp/m3-canonical-v2-foundation`, open the PR
against `main`.

The fourteen commits in this slice that touch a live-path file, in order.
Two are not part of the canonical-v2 gated buildout and should be read in
full individually before approving this slice; they are marked:

| SHA | Date | Subject |
|---|---|---|
| `1ce030c7` | 08-02 23:53 | feat(taxonomy): v1 reclassification, R1/R2/R3 splits, retired-code enforcement (**read in full: touches `lib/parser-v2/classify.js`, `lib/rubric.js`, and the `REP-T-CONSENT` to `REP-T-GOVAPPROVAL` rename that Part 2 flags**) |
| `142999f0` | 08-03 09:41 | fix(review): isolate representation bring-down sides (**read in full: direct fix to `conditions.config.js`/`representations-qualifiers.config.js`, not gated**) |
| `f3739409` | 08-03 14:37 | feat(canonical-v2): assign M3 P0 product surfaces |
| `ae349280` | 08-03 14:58 | feat(canonical-v2): cover proxy meeting follow-on rows |
| `73c798c6` | 08-03 15:11 | feat(canonical-v2): project closing conditions to product surfaces |
| `83047760` | 08-03 15:50 | feat(canonical-v2): project antitrust to product surfaces |
| `9ed562d1` | 08-03 16:20 | feat(canonical-v2): close termination product parity |
| `7adbadbe` | 08-03 17:09 | feat(canonical-v2): close proxy meeting product parity |
| `261f41a2` | 08-03 12:26 | feat(canonical-v2): publish employee and D&O parity |
| `b974a7a6` | 08-03 12:47 | feat(canonical-v2): publish remedies and boilerplate parity |
| `55f10bf3` | 08-03 13:17 | fix(canonical-v2): compose family product ownership |
| `02d9ee8e` | 08-03 13:16 | feat(canonical-v2): publish material contracts parity |
| `2ab881a5` | 08-03 13:54 | feat(canonical-v2): publish general covenants parity |
| `98c22b43` | 08-03 14:37 | feat(canonical-v2): close proxy meeting follow-ons |

Extract this list again at execution time with:

```
git log --oneline main..0d17ad0085a2a6b365448637d9dbdccb6d20871c -- \
  components/review/table-configs/ components/review-v2/ \
  components/review/ProvisionTable.jsx components/DealsTable.js \
  'pages/api/review/[id]/cards.js' pages/compare.js 'pages/api/compare.js' \
  'pages/query/[kind]/[id].js' pages/corrections-review.js pages/admin/ \
  pages/api/corrections/ pages/api/admin/ pages/api/provisions.js \
  lib/queries/
```

*Acceptance criteria, slice 1:* `test-and-build` green, all ten invariants
green, `phase-allowlist` green, `schema-parity` green or cleanly skipped,
the fourteen commits above individually read (two in full per the note),
Part 6 items 2 and 3 pass on the slice's own preview deployment.

*Slice 2 setup* (open only after slice 1 is merged, so its diff against
`main` is exactly these eight commits):

```
git fetch origin
git checkout -b wp/m3-tonight-integration-and-live-fixes codex/m3-production-phase1
```

Add `.github/phase-allowlists/wp-m3-tonight-integration-and-live-fixes.json`:

```json
{
  "phase": "WP-M3-TONIGHT-INTEGRATION-AND-LIVE-FIXES",
  "required_work_class": "implementation",
  "allowed": [
    ".phase-id",
    ".phase-raw-id",
    ".github/phase-allowlists/wp-m3-tonight-integration-and-live-fixes.json",
    "lib/canonical-v2/**",
    "lib/query/**",
    "lib/review-parity/**",
    "lib/parser-v2/**",
    "lib/programme-gates/**",
    "lib/queries/**",
    "lib/corrections/**",
    "lib/row-market-stats/**",
    "lib/schema-shape/**",
    "lib/reports/**",
    "lib/market-metrics/**",
    "lib/schema/**",
    "lib/provisions/**",
    "lib/ingest/**",
    "lib/termf.js",
    "lib/programme-decision-console.js",
    "lib/edgar-catalog.js",
    "lib/agreement-revision-classifier.js",
    "components/DealsTable.js",
    "components/review-v2/*.jsx",
    "components/review-v2/compareRowUnion.js",
    "components/review/ProvisionTable.jsx",
    "components/review/table-configs/*.config.js",
    "components/review/table-configs/canonical-v2-preview-lane.js",
    "pages/admin/registry/reconcile.js",
    "pages/api/admin/reconcile/decide.js",
    "pages/api/compare.js",
    "pages/api/corrections/review.js",
    "pages/api/provisions.js",
    "pages/api/review/[id]/cards.js",
    "pages/compare.js",
    "pages/corrections-review.js",
    "pages/design/programme-decisions.js",
    "pages/query/[kind]/[id].js",
    "tests/**",
    "docs/**",
    "scripts/**",
    "evidence/**",
    "__fixtures__/**",
    "supabase/**",
    "sql/**",
    "PLAN.md",
    ".vercelignore"
  ],
  "denied": [
    ".env*"
  ],
  "note": "The provision_instance_id claims fix, the termination-fee card-attribution fix, three compare-mode bug fixes, the MAE pill relabel, the per-family V2 serving switch wiring into pages/api/review/[id]/cards.js, retirement of the dead /compare page, and the documentation archive move. See MERGE-PLAN.md Part 2 and Part 5."
}
```

The eight commits in this slice, all of them, in order (small enough to
read every one in full; do so):

| SHA | Files | What it is |
|---|---:|---|
| `59568f92` | 232 | feat(canonical-v2): M3 preview activation, parity truth and identity fixes. Introduces the preview-lane gate; also touches `lib/queries/review-deal.js` (the provision_instance_id fix). |
| `61d7280c` | 40 | feat: retire duplicate compare surfaces, harden quote grounding, consolidate plan. Deletes `pages/compare.js` and `pages/api/compare.js`. |
| `51f91a2c` | 57 | docs: archive superseded material, correct the roadmap. The documentation move that breaks phase-allowlist (Part 4). |
| `14c7b8f2` | 111 | feat: per-family V2 serving switch, V1/V2 side-by-side, parity harness. Wires `attachCanonicalTerminationFeeServing` into `cards.js`; also touches `review-deal.js` again. |
| `e8fe6ed5` | 13 | evidence: preserve the 12-family M3 pilot run before it is lost. 146,199 insertions, entirely JSON, zero code. |
| `f8009ef2` | 7 | fix: narrow card selection, wire late-payment interest, rewrite the roadmap. The `isTerminationFee()` family-exclusivity fix. Smallest, most surgical commit in this slice; read it first. |
| `887d32ef` | 1 | docs: the twelve decisions, with context and a recommendation each. |
| `c9da7226` | 1 | docs: record decision 1, open site risk accepted. |

*Acceptance criteria, slice 2:* same mechanical bar as slice 1, plus every
item in Part 6's checklist against the slice's own preview deployment
before merging, then again against production after merging.

*If more caution is wanted than two slices.* There is a second, smaller
density gap inside slice 1, between commit `87fb007c` (2026-08-03 23:37)
and `0d17ad00` (2026-08-04 15:48), which would split slice 1 in two without
cherry-picking anything, at the cost of one more PR to sequence for
work this assessment already found to be uniformly gated. Not recommended
as the default; offered as the next lever if slice 1 still reads as too
large in the GitHub UI.

*Keeping this current.* The branch was moving while this was written.
Before executing, check what has landed since this document's pinned SHA:

```
git log --oneline c9da72266771bd4b24140456b26a96bed56da7a5..codex/m3-production-phase1
git diff c9da72266771bd4b24140456b26a96bed56da7a5...codex/m3-production-phase1 --name-only -- \
  components/review/table-configs/ components/review-v2/ \
  components/review/ProvisionTable.jsx components/DealsTable.js \
  'pages/api/review/[id]/cards.js' lib/queries/ pages/query/ pages/admin/ \
  pages/api/corrections/ pages/api/admin/ pages/api/provisions.js
```

Anything the second command lists is a new live-path change; read it with
the same method Part 2 used (find the commit, read the full diff, confirm
whether it is gated) and fold it into slice 2 or a new slice 3, never
silently into slice 1.

---

## Part 6. Verification after merge, on the live site

**What it is.** A green build proves the code compiles and the unit tests
pass against fixtures. It does not prove a person looking at a real deal
sees the right thing, and ROADMAP.md 3.4 records that this product has no
error tracking and no health endpoint, so nobody finds out from monitoring
either. Do this by hand, on the deployed site, after each slice.

One nuance that changes where you look: the runtime gate
(`isPermittedCanonicalV2Runtime`) explicitly permits `VERCEL_ENV ===
'preview'`. That means a PR's own preview deployment may legitimately show
Canonical V2 preview content if the corresponding environment variable is
also set on that Vercel environment; that is not a bug. What the gate
guarantees is production, specifically, stays closed regardless. Check
`precedent-machine.vercel.app` itself (or whatever the current production
alias is) for the items below, not only the PR preview URL.

1. Pick two or three real deals across different families (at minimum one
   with a termination fee, one with an MAE definition, one with
   representations-qualifiers content). Load `/review/<id>` for each.
   Confirm the page renders, no browser console errors, and no expanded or
   populated "Canonical V2 Preview" lane is visible (it should either be
   entirely absent, since the section only renders when it has rows).
2. On the termination-fee deal, confirm the fee table still shows the rows
   it showed before this merge (cross-check against a note, screenshot, or
   your own memory of that deal if one exists). The `isTerminationFee()`
   fix should only ever remove a row that was misattributed from another
   family, never a genuine termination-fee row.
3. On each deal, confirm row order and content generally looks right; this
   is the surface-level check for the `provision_instance_id` claims fix
   (item 1's file), which touches every card.
4. Open compare mode on the representations-qualifiers deal against a
   second deal: `/review/<id>?compare=<id2>`. Confirm the general-exceptions
   and knowledge-summary rows show real content (SEC cut-off, portions
   excluded, disclosure letter, knowledge standard and persons), not a bare
   "-".
5. Open compare mode on the MAE deal against a deal with both a Company and
   a Parent MAE test. Confirm "Company MAE" and "Parent MAE" divider bands
   appear and no two rows read identically with no way to tell them apart.
6. Open compare mode on a conditions or material-contracts deal. Confirm
   each deal's own column shows an "N of M present" coverage footer, not
   only the market column.
7. On any deal with MAE carve-outs, confirm the "Disproportionate carveback"
   pill reads "Yes" or "Not established", never "No". If "No" still
   appears, the old build is still being served somewhere (CDN cache,
   stale deployment); do not treat it as a code problem before ruling that
   out.
8. Visit `/compare` directly. Confirm a clean 404, and confirm nothing in
   the product's own navigation (deals list, review page, header) links
   there. Both were true before this merge too; this just confirms nothing
   regressed.
9. Load `/corrections-review` and `/admin/registry/reconcile`. Confirm both
   still load and, if you have an editor key, that an approve or reject
   action on a test correction still completes. These files only changed by
   a doc-comment fix, so this is a smoke test, not a deep check.
10. Read the Vercel function logs by hand for the first hour after each
    slice deploys (there is no error tracking to page you, per ROADMAP.md
    3.4). Look specifically for errors originating in
    `pages/api/review/[id]/cards.js`, since it is the highest-traffic route
    touched by this merge.
11. One item this assessment could not verify without database access:
    query whether any row in the claims table (or provision_cards) still
    carries the retired `REP-T-CONSENT` code, and whether claims rows
    consistently carry a correct `provision_instance_id`. Both are
    asserted true in code comments (Part 2) but are operational facts about
    the live corpus, not something git can confirm. If nobody can run this
    query before merging slice 2, treat items 3 and the
    consents-and-approvals row grouping in compare mode as the two things
    to watch most closely in production afterward.

**Technical.** None of the above requires `npm test` or `npm run build`;
those already ran in CI before merge. This is deliberately a human,
browser-based pass, because that is the one thing CI cannot do: look at a
rendered page and judge whether the legal content is right.

---

## Appendix: how this assessment was produced

Every command below is read-only except the one trial merge, which was
aborted-by-nature (git reported nothing to merge) and left no repository
state behind; this was independently confirmed by checking for
`.git/MERGE_HEAD` (absent) and comparing `HEAD` before and after (unchanged
at `c9da72266771bd4b24140456b26a96bed56da7a5`). The current branch was
checked before and after every command and was `codex/m3-production-phase1`
throughout. No source file was edited. This file is the only file written.

Commands used: `git branch --show-current`, `git status --short`, `git log`
(with `--oneline`, `--pretty`, `--reverse`, path filters), `git diff`
(three-dot, `--stat`, `--shortstat`, `--name-only`, `--name-status`, path
filters), `git show` (file-at-ref and commit-stat forms), `git merge-base`
(plain and `--is-ancestor`), `git rev-list --count`, `git cat-file -e`, `git
merge --no-commit --no-ff main` followed by verification there was nothing
to abort, `git grep` (for dead-link confirmation), and `gh api` /
`gh repo view` (for branch-protection and ruleset status, read-only, no
repository state). Source files read in full rather than only diffed:
`ROADMAP.md`, `.github/workflows/ci.yml`, `scripts/ci/detect-phase.js`,
`scripts/ci/check-allowlist.js`, `components/review/table-configs/
canonical-v2-preview-lane.js`, `lib/canonical-v2/feature-flags.js`
(relevant functions), `lib/canonical-v2/dark-bridge-gate.js` (relevant
functions), `lib/canonical-v2/termination-fee-serving-source.js` (relevant
functions), `lib/design/route-guard.js`, `lib/queries/claims-adapter.js`
(relevant function).
