# The plan to production

Rewritten 2026-08-05 from a full evidence sweep, then restructured after an
adversarial review found the ordering wrong.

This is the plan. `OPERATING-RULES.md` holds the authority boundary and the
owner's rulings; read that once before starting. `WORK-COMPLETED.md` is the
historical record and is not required reading.

---

## How to read this

Every step has two parts, in this order:

1. **What it is.** Plain English. No internal names, no status codes. If you
   only want to know what we are doing and why, read only these.
2. **Technical.** Enough detail for an agent to execute the step unattended:
   file paths, acceptance criteria, an unambiguous definition of done. Skip
   unless you are doing the work or reviewing it.

Nothing here grants authority. Production remains prohibited until Ben says
otherwise.

**The work runs in three lanes that proceed in parallel.** Lane P is the
product. Lane S is security. Lane D is delivery. They interlock at exactly
three points, named where they occur. An earlier draft of this plan ran
everything in one queue behind security; that was wrong, and why is recorded
under "A correction to this plan's own ordering" below.

---

# Part 1. What the product is

The product reads merger agreements filed with the SEC, pulls out the terms a
deal lawyer cares about, and lets you read them, compare them across deals,
and ask what is normal.

Three surfaces:

- **The review page.** One deal, its provisions in tables by topic. This is
  the thing people use.
- **Search.** Ask a question across every deal. Currently switched off.
- **Market statistics.** What is normal for a term across comparable deals.
  Currently switched off.

Two extraction systems. The older one, V1, is what production serves today. A
newer, more rigorous one, V2, has been built alongside it. Almost all the
remaining work is proving V2 is trustworthy and switching to it without a gap
where the product is wrong.

---

# Part 2. What exists today

## 2.1 The pipeline, SEC filing to screen

| # | Stage | What happens | Kind |
|---|---|---|---|
| 1 | Discovery | A daily job watches SEC EDGAR for new merger filings | deterministic |
| 2 | Exhibit selection | Decides which attached document is *the* merger agreement | deterministic |
| 3 | Fetch and clean | Downloads it, strips HTML, normalises whitespace | deterministic |
| 4 | Section classification | Cuts the document into sections and types each | mixed |
| 5 | Extraction | Reads each section and pulls out structured facts | **model** |
| 6 | Storage | Writes to two separate database layers | deterministic |
| 7 | Resolution (V2) | Decides which candidates are trustworthy enough to be facts | deterministic |
| 8 | Projection (V2) | Turns trusted facts into renderable rows | deterministic |
| 9 | Rendering | Draws tables, runs searches, computes statistics | deterministic |

**The two data layers cause real bugs.** Facts live in `claims`, which drives
the review page, and in `ai_metadata.features` on provisions, which drives
search. A field written to one is invisible to the other. Sync scripts exist
and are run by hand. This is the usual cause of "the review page shows it but
search cannot find it".

**Quotation provenance is the weak point.** Three coordinate systems are in
play for "where in the document did this quote come from": relative to a
section, relative to a card's own excerpt, and relative to the whole cleaned
text. Two database columns hold values computed in one system that downstream
code reads as another. They are populated and wrong. Absent offsets fail
safely; wrong ones invite the next reader to trust them.

## 2.2 What works in production right now

Live on `main`:

- The review page, on the V1 data path, for 40 deals.
- Side-by-side comparison of up to three deals on the review page.
- The admin pages.
- The daily EDGAR watch job.

Switched off in production: all search (7 routes), all market statistics (3
routes), all ingestion (8 routes, so **no new deal can enter through the
product**), and everything V2, hard-off on two independent signals.

## 2.3 What V2 is, and what it can do

V2 is large and rigorous: 130 defined claim types, 25 extraction prompts, a
named resolver for every family, 17 projection modules. Its design principle
is that the system never asserts a negative. It reports what it found with
evidence, and "absent" is derived later from proven coverage rather than
guessed by a model.

**Three things break the claim that it works end to end.**

**Almost no real data.** One family has committed model output from a real
run: Representations, five responses covering three deals using one prompt.
Everything else is fixtures. Some are real agreement text with no model
output. Several are synthetic: three families are represented by a single
fabricated card under 600 bytes with an invented deal identifier, and one
family's test data uses "acme-globex" as party names with none of its eight
quotes appearing in any real agreement.

One genuine twelve-item run across eleven families existed only outside the
repository, one deletion from being lost. It is now committed at
`evidence/canonical-v2/m3-pilot-20260804-fresh/`.

**Nothing serves, in production, and not because of a version limit.** Every
Canonical V2 surface is hard-off there on a runtime check that ignores
contract version entirely; see P3. A separate limit does exist: it admits
only contract versions 1 to 5, plus one exception at version 12, and roughly
110 of the claim definitions live above it, so registering a new one still
costs eleven file edits regardless. But no live route reads that limit to
decide what serves; it is not why nothing reaches a user. **The runtime
check in P3 is the production bottleneck. The version limit is not, and
raising it was never going to fix this.**

**Two projection modules are dead code.** Merger Structure and Miscellaneous
Boilerplate key on claim types and concepts that do not exist. Their tests
pass because the tests build the missing vocabulary themselves.

## 2.4 By family

"Complete" means definition through projection present and consistent. It
does not mean proven on real data.

| Family | Claims | Projection | Real data | Gap |
|---|---:|---|---|---|
| Antitrust / Regulatory Efforts | 16 | complete | fixture | data |
| Appraisal & Dissenters' Rights | 3 | complete | synthetic | fabricated fixture |
| Closing Conditions | 15 | **11 of 15** | fixture | 4 claims resolve then vanish |
| Consideration | 3 | complete | fixture | data |
| Dividends | 3 | complete | synthetic | fabricated fixture |
| D&O Indemnification | 9 | complete | fixture | data |
| Employee Matters | 5 | complete | fixture | data |
| Financing Covenants | 5 | complete | fixture | data |
| Guaranty / Financing Party | 3 | complete | fixture | best built; needs data |
| Interim Operating Covenants | 2 | **1 of 2** | fixture | one claim unprojected |
| Key Defined Terms | 14 | complete | **none** | no fixture at all |
| MAE Definition | 3 | complete | real text, no run | data |
| Merger Structure & Closing | 1 | **dead code** | none | vocabulary mismatch |
| Miscellaneous Boilerplate | 1 | **dead code** | none | vocabulary mismatch |
| No-Shop | 15 | **no module** | fixture | separate architecture |
| Proxy & Meeting Covenants | 11 | complete | **none** | no fixture at all |
| Representations | 11 | **2 of 11** | **real, committed** | 9 claims unprojected |
| Specific Performance / Remedies | 3 | **2 of 3** | fixture | one claim absent |
| Tax Matters | 6 | complete | synthetic | fabricated fixture |
| Termination Fee | 5 | **3 of 5** | fixture | 2 unprojected |
| Termination Rights | 3 | complete | fixture | self-declared scope gap |
| Material Contracts | 3 | 2 of 3 | fixture | analysis not finished |
| No Other Reps / Fraud | 6 | complete | fixture | analysis not finished |
| General Covenant Router | 1 | complete | synthetic | analysis not finished |

**Eleven families are structurally complete and blocked only by data and
their own per-family serving switch**: Guaranty, D&O, Employee Matters,
Financing, Tax, Key Defined Terms, Antitrust, MAE, Proxy & Meeting, No Other
Reps, General Covenant Router.

**Capitalisation is the most proven component in the system and is tracked
nowhere.** Largest extraction prompt in the repository, three claim types, the
only component with real recorded model output. It does not appear in the
parity register.

## 2.5 By product area

143 tracked surfaces, 103 blocked. It was 104 until the compare-locator
work cleared exactly one, described in step P9.

| Area | Surfaces | Blocked |
|---|---:|---:|
| Review page rows | 44 | 34 |
| Search fields | 35 | 28 |
| Market statistics | 31 | 25 |
| Derived values | 16 | 11 |
| Side tables | 5 | 3 |
| Compare fields | 3 | 3 |

Blocked surfaces split four ways: **73** where the analysis is finished and
approved but nothing displays it; **27** where the analysis genuinely is not
done, all in four areas (Material Contracts, No Other Reps, General
Covenants, Representations); **3** with no owner; **1** behind a switched-off
route.

**Turning search and market back on clears one of the 103.** Not fifty-three.
The count is not an argument for that work; product value is.

---

# Part 3. The four honest gaps

## 3.1 There is no authentication

The application has no login. No middleware, no auth library, no session, no
API keys except two static shared secrets on two routes. **Nineteen API
routes use the database service key, which bypasses row-level security, with
no identity check.**

What stands in its place is eighteen hard-coded "temporarily unavailable"
responses. The four routes a July security review graded critical were
*contained, not fixed*. The live create, update and delete handlers are still
present behind those stubs.

**Two things only Ben can check, and they come first:** whether
`precedent-machine.vercel.app` requires a login, and whether the database
service key exposed in a chat transcript in July was rotated.

The corpus is 40 public SEC filings, so read exposure matters less than it
sounds. What makes this serious is that the same routes carry live *write*
handlers. The risk is destructive, not confidential.

## 3.2 The evidence base is thinner than the register says

The register records fixture proof passed for all 21 families. Twenty of
those families' own design specs say no real recorded runs exist. The
register cites a provider file's existence as evidence a producer ran, which
proves only that a file exists.

Eleven of fifteen directories named `*-live-run/` contain no live run, and the
lint script exempts any path matching `live-run` from prose checking, so the
name buys a waiver. One design spec warns in writing against exactly this.

Even a genuine live run can carry a defect nobody chose. A tool that cuts an
agreement into sections was capping section titles at a fixed length; a title
longer than that was never recognised, so on one deal it silently folded five
whole sections, including an entire article, into the section before them,
and stamped the wrong reference on what it kept. That defect is now fixed and
checked by a tripwire that raises an alarm the moment it happens again on any
future filing. But one already-committed live run,
`tests/fixtures/canonical-v2/f28-third-live-run/`, a Capitalisation item on
TopBuild, was produced before the fix: forty of its entries still cite a
section reference that does not exist in the agreement. The underlying bytes
and the model's own extracted reference were always correct; only the label a
downstream tool attached is wrong. This is mislabelling to regenerate, not
lost data, and regenerating that committed evidence is Ben's call, not made
here.

The module that replays recorded responses checks four things and never
verifies the model, the timestamp, the provider, or that quotes appear in the
source. A hand-typed file passes identically.

None of this is fraud. It is scaffolding that accumulated names implying more
than it delivers. But the plan cannot rest on it.

## 3.3 One in seven search fields returns the wrong term

104 of 699 fields in the query registry resolve to a **different field** than
the one named, because an earlier entry's alias list shadows a later entry's
own key. Verified examples: the parent's public-statements carve-out returns
the **company's** (a party inversion); the fiduciary-out standard returns the
*engagement* standard (a different legal test); a months-valued field is
typed as US dollars.

Latent while search is off. Live the moment it is on.

## 3.4 The programme gates cannot be closed

All 25 pre-production gates' declared status still reads "open" and cannot
read anything else: the loader throws if any gate's declared state is not
open, deliberately, so the frozen contract stays byte-identical to what was
reviewed. Two gates have their substantive work finished, and a second, live
channel now computes and records their real pass state separately from that
frozen field, re-checking the evidence itself every time rather than trusting
a stored claim. See D3 for how it works and what it does not change.

Of 289 mandatory adversarial tests, **7 are implemented and 282 throw "not
implemented"**, corrected from earlier figures in this document of 8 and 281.
The one fewer is a fix, not a regression: the test that had been counted as
covering authentication was withdrawn because it was regular expressions over
a script's source text and never made a request, and someone removed the
false "implemented" label rather than leave it standing. See D3 for the exact
count and what the 7 real ones and the remaining 282 each cover.

Every defect actually caught in this codebase was caught by ordinary
engineering: the served-set check, real end-to-end tests, adversarial probing
with the gate off. Step D3 records what was done about this and what is
still open.

---

# Part 4. The steps

## A correction to this plan's own ordering

An earlier draft ran every step in one queue behind authentication, on the
claim that "every remaining step removes a containment from a route with no
identity check." **That claim is false.** Steps P1 to P6 are offline library
work, local extraction, or run behind a flag that cannot evaluate true in
production. Only P7, P8 and D2 touch containment, and two of those are
preview-only.

The mutation surface is also mechanically closed today:
`lib/service-client-route-actions.js:235-237` throws at module load if any
public-mutation route is not hard-contained, and the four critical routes are
contained stubs on `main`. The programme's own gates already encode the right
dependency: `programme-gates.yaml:171-180` makes the security gate a
prerequisite for **import and activation**, not for engineering.

So the lanes run in parallel. Security gates only the last three steps. D1,
the merge to `main`, depends on neither lane and is authorised to start now;
it moves first, below.

---

## D1. Merge to main: done, three times over, and now open again in miniature

**Correction, 2026-08-06.** This step previously read as still pending: "This
branch is 287 commits and 910 files ahead of main... None of it has ever
passed CI as a merged unit." That stopped being true on 2026-08-05. The merge
happened, in exactly the shape `MERGE-PLAN.md` proposed, as three pull
requests: #476 (`wp/m3-canonical-v2-foundation`, merged
2026-08-05T21:55:41Z), #477 (`wp/m3-tonight-integration-and-live-fixes`,
merged 2026-08-06T00:30:37Z), and #478 (the whole `codex/m3-production-phase1`
branch head, merged 2026-08-06T09:51:01Z). Checked directly against GitHub,
not against another document: `gh pr list --state merged --json
number,title,mergedAt,baseRefName,headRefName`. `origin/main` is now at
`016288cb`, the merge commit for PR #478. What follows below is left as
written, as the record of the step that was authorised and then carried out;
read it in the past tense.

**What is actually open now.** Work continued on `codex/m3-production-phase1`
after PR #478, including the documentation audit this correction is part of.
As of this correction the branch is 15 commits ahead of `origin/main` again
(`git log --oneline origin/main..HEAD`; this number moves as other agents
land documentation-only commits on this same branch concurrently, run the
command rather than trust the figure), not yet merged. This is a small,
fresh merge, not a revival of the original 287-commit backlog; it needs its
own slicing decision if `MERGE-PLAN.md`'s per-phase-allowlist discipline is
still wanted for it, but it is nowhere near the size or risk of what is
described below.

**What it was.** This branch was 287 commits and 910 files ahead of `main`,
with 314,632 lines inserted. Production tracks `main`. None of it had passed
CI as a merged unit until the merges above.

**Why it mattered.** Step D2 was unreachable without it, and it was
plausibly weeks of integration on its own. Treating it as ambient was how it
would have become a crisis, which is why it was authorised immediately
rather than left for later.

**How it was sliced.** Recorded in `docs/codex-program/MERGE-PLAN.md`,
itself corrected 2026-08-06 to state plainly that its plan was executed.
Read that document for the actual slicing that was used.

**Done when.** Was: the branch is merged, CI passes on `main` as a merged
unit, and the deployed site is verified live rather than assumed. All three
merges above passed CI (each landing commit's own message records "Suite
green as CI runs it"); live-site verification after PR #478 specifically was
not independently re-checked as part of this correction.

**Technical.** The `phase-allowlist` CI job ran on these pull requests and
the allowlist mechanism `MERGE-PLAN.md` designed was used to satisfy it. Run
`npm test` plus `npm run build` on any future merge result, not just on the
branch, exactly as this instruction originally said.

---

## Lane S: security

### S0. Check two things in a browser

**What it is.** Confirm whether the live site requires a login, and whether
the database key exposed in July was rotated. Neither is answerable from the
code.

**Why first in this lane.** If the site is open, the corpus is reachable now.
Fifteen minutes.

**Needs from Ben.** This one is entirely his.

### S1. If the site is open, turn on deployment protection today

**What it is.** A platform setting, not a code change. Vercel deployment
protection covering production, not just previews.

**Why.** It closes the exposure in fifteen minutes rather than the weeks S2
takes. It is not a substitute for authentication; it is the thing that makes
taking those weeks safe.

**Technical.** Vercel project `deal-corpus` (`prj_pseZ68ISXsxADzNcffHTO2NuGM8b`),
which owns `precedent-machine.vercel.app` and the `main` alias. Current
setting: SSO protection enabled, scoped `all_except_custom_domains`. There
are no custom domains, so confirm empirically whether that covers the
production alias; a probe of the sibling project's alias returned HTTP 200
unauthenticated.

### S2. Ship authentication

**What it is.** Put a login in front of the application, then repair the four
routes that were switched off instead of fixed.

**Why it matters.** It is the hard gate before import and activation. It does
not gate the product work.

**Done when.** An unauthenticated request to every route is refused, proven by
tests that make real requests rather than reading source. The four critical
routes are repaired, not contained. A written route-and-action inventory
exists.

**Decided.** Session cookie: a login page sets it, the API checks it. See
`DECISIONS.md` item 2 for the full reasoning. A draft exists and dies
without this being built, because every page fetches its own API routes and
nothing sends a credential yet.

**Technical.** Branch `wp/api-auth-middleware`, commit `e05bfeb5`, +493 lines,
inert behind `API_AUTH_ENABLED`. No `middleware.js` at HEAD, no auth
dependency in `package.json`. Enumerate targets with
`grep -rl getServiceSupabase pages/api/` (19 routes). The four graded
critical: `pages/api/users.js` (reads `is_admin` from the request body),
`ingest/from-url.js` (unauthenticated SSRF), `admin/reprocess-cond.js`
(unauthenticated destructive delete and reinsert), `saved-queries.js` (admin
self-grant). Live write handlers remain in `deals.js`, `provisions.js`,
`provision-types.js`. Acceptance: a test that starts the app and asserts 401
on every inventoried route without credentials.

---

## Lane P: product

### P1. Prove one family end to end on real data

**Done, for termination fees.** It needed nothing from Ben and nothing from
lane S, and it is now proven on live model output, not argued from a design
document.

**What it is.** Take termination fees, run V2 extraction on the deals we have,
show V1 and V2 side by side on the review page, and read off every
difference.

**Why it mattered.** This was the first honest measurement of whether V2 is
better than V1. Everything downstream assumes it is, and until this work,
nobody had checked.

**Done when.** The side-by-side view renders for real deals, and there is a
written list of every field where V1 and V2 disagree, with a judgement on
which is right. Both halves that were blocking this are now solved, each
proven on a live model run rather than merely designed.

The amount half: one defined term pays $10,000,000 under three termination
grounds and $15,000,000 under two others, and it used to resolve to whichever
figure the model happened to quote first. A new field lets each side of that
condition carry its own verbatim proof of its own figure, checked against the
source before the resolver trusts it. A live model run populated it
correctly, unprompted, on its first attempt, and three claims resolved where
the earlier run resolved one (`6d8d453e`, `d501cee2`).

The trigger half: a fee trigger stated only as a cross-reference to another
section could never be named, because each section is shown to the model in
its own isolated call, never alongside the section it cites. The cited
section is now dispatched as its own call and joined back afterwards. A live
run proved this works: it recovered two termination grounds nothing had ever
named before, including one that earlier analysis had recorded as a genuine
miss (`8bd4cb32`, `643cacc0`). That same run also showed a real cost: it
published one fact three times over, and it minted a link to a fact that was
never published. Both are now fixed: repeated sightings of the same fact are
reconciled into one after resolution, keeping the most direct and most
specific evidence and recording what was folded in; a link between two facts
is only ever created by looking both of them up in the final published set,
never by guessing where one will land. Replayed against the same run, nine
resolved claims correctly become six, and the false link is gone (`84518eef`).

Both live runs are pinned as committed evidence and replayed by a test with
no network call and no model call, so this proof does not depend on repeating
a paid run.

**What is still open.** Citation-following, the trigger-half mechanism above,
is built and correct, and it ships off by default: following every citation
in this one filing took the run from three model calls to fourteen, from
$1.32 to $4.00, and from 7 to 18 minutes, for this one family on this one
deal. Whether it becomes the default across the corpus, given that cost
multiplied across every family and every deal, is Ben's decision, not made
here. Separately: Modiv itself is still not wired into the live per-family
switch, which still has exactly one entry, QXO/TopBuild, so the side-by-side
view does not yet render Modiv's termination fee data on the actual review
page. What is proven above is that the extraction and resolution are
correct, replayed end to end from cutting the agreement into sections through
final validation. Connecting a second deal to the screen without hand-writing
a new file for it, the way QXO/TopBuild's was hand-written, is separate work
and has not been done.

**Technical.** Built and committed: the per-family switch at
`components/review/table-configs/termination-fees.config.js` `selectRows()`;
side-by-side behind `CANONICAL_V2_TERMINATION_FEE_COMPARE`; the equivalence
harness at `scripts/review-parity-check.js`; real pinned source for
QXO/TopBuild in `lib/canonical-v2/termination-fee-serving-source.js`.
Citation-following is opt-in only, via `--follow-citations` on the extraction
run script (`followCitations: false` by default,
`scripts/canonical-v2-modiv-termination-fee-scope-correction-run.mjs`), and
is not wired to any production flag. Both live runs are replayed by
`tests/canonical-v2-modiv-termination-fee-scope-correction-replay.test.js`
and `tests/canonical-v2-modiv-termination-fee-citation-following-replay.test.js`.
The runner requires `prompt_budget_split_preflights` and
`max_model_invocations` in its manifest. Retries are effectively off: the
Codex path sets `maxRetries: 0`, the Anthropic path allows two with no
backoff. Acceptance for a fresh run: harness exits 0 or 1, never 2 (which
means coverage incomplete), and a human reads its report field by field.

### P1 addendum, 2026-08-06. All 25 families run once against real data

**What it is.** Every registered section family, not just termination fees,
was dispatched against Modiv in a single sweep: 58 model calls, $20.30,
resolving 108 claims, queueing 203 for human review, and leaving 193
candidates in open world (no governed home at all). Pinned as a baseline
before any of the fixes below, so a later re-run can be measured against it
rather than against impressions:
`docs/codex-program/notes/all-families-baseline-20260806.json`. Full detail:
`docs/codex-program/notes/all-families-aggregate.md`,
`all-families-aggregate-review.md` (the adversarial check on that first
analysis, which found its fix plan covered at most 74 of the 193 open-world
candidates and named 119 with no owner), and `open-world-ownership.md` (the
follow-up that classified all 193).

**Why it matters.** P1 above proved the mechanism works for one family. This
is the first time the same mechanism was pointed at everything the product
is meant to eventually extract, in one sweep rather than one family at a
time, and it is the first real evidence of where the whole extraction layer,
not just termination fees, actually stands today.

**Three crashes, fixed, none of them the model's fault.** Each reproduced
offline from the real recorded evidence before being touched
(`docs/codex-program/notes/extraction-crashes.md`):

- A shared helper, used by two different resolution steps, handed back its
  caller's own in-progress list of unmatched items by reference instead of a
  copy, then froze that list as part of building an unrelated result. Every
  family's run has been doing this silently for as long as this code has
  existed; it only crashed the one family (interim operating covenants)
  whose own code writes into that list a second time afterward. Fixed by
  copying, not aliasing, at the point the list is handed back.
- A second family's resolver rebuilt a claim's data wholesale rather than
  merging into it, and the rebuilt version dropped one required provenance
  tag that every other resolver in the same file remembers to keep. The
  family produced three good answers, then crashed two steps later, in a
  check that a governed answer must always say where it came from.
- A third family's run received a reply from the model that was not the
  data it asked for: over a thousand characters of ordinary prose narrating
  that a file had been written, not the file itself, consistent with the
  model going agentic under the command-line transport rather than the
  reply being truncated. The old behaviour discarded the whole batch on this
  kind of failure, including earlier sections in the same batch that had
  already succeeded and been paid for. Fixed by keeping what already
  succeeded when a later step in the same batch fails, instead of
  discarding it.

**A legal-correctness defect, found and fixed, separately from the
25-family sweep.** Adversarial testing found that the live, production
quote-acceptance gate would accept a quote with a governing negation cut
from its front, for example storing "have a Company Material Adverse
Effect" as if it were the whole sentence when the source actually read
"would not have a Company Material Adverse Effect": a stored quote reading
as genuine, verbatim evidence for the opposite of what the agreement says.
This was live in production with no boundary check of any kind, and two
committed tests literally named "KNOWN LIMITATION" pinned the unsafe
behaviour as expected. Both are now fixed, at the live production
quote-acceptance path (`lib/verification.js`) and at one of the four preview
bridges (`representations-dark-bridge.js`); a second bridge was attempted,
found to need a more careful fix than first tried, and deliberately
reverted rather than shipped half-right; the most principled version of the
fix, capturing a quote's position before any trimming rather than
re-deriving it afterward, is specified but not built, because it belongs in
a file that was under another agent's active edit at the time. Full
account, including exactly what remains open and why:
`docs/codex-program/notes/negation-reversal.md`. `WORK-COMPLETED.md` is
corrected to match; it previously claimed this was tracked in this
roadmap's known risks as "step 1b", which never existed.

**Termination corroboration: one resolved claim becomes eight.** The
termination family (which party may exercise a given termination right, a
different family from termination fees above) was refusing nearly every
candidate because the right's own chapeau names no party, which describes
most of Modiv's rights: the party is only named down in each lettered
limb's own grant language ("by written notice from Parent to the Company"),
and every limb names both parties, so a naive text match would have
attributed a right to the wrong side on roughly half of them, an answer
worse than refusing because it reads as correct. Fixed by anchoring
corroboration on the specific limb a candidate cites, reading that limb's
own grant direction ("from X to Y" grants to X), and failing closed
whenever the direction cannot be determined. Twelve candidates, the single
largest blocked group in the 25-family sweep, clear this gate; six of them
then queue at a different, pre-existing gate, on four identified vocabulary
gaps left named rather than fixed.
`docs/codex-program/notes/resolver-reference-fixes.md`.

**Open-world candidates: all 193 classified, 21 given a governed home in
code.** `open-world-ownership.md` traced every one of the 193 to one of
fifteen mechanisms and fixed the ones that were genuinely mechanical.
Material contracts' corroboration vocabulary was too narrow for real
drafting ("Space Lease", "earn-out", hyphenated "in-bound"/"out-bound"), now
widened, moving 10 of its 26 open-world items to resolved, verified by
replaying the real recorded run with no regressions. Antitrust's 11
open-world items were not a vocabulary gap at all: the extraction runner
was compiling an old version of the shared contract definitions (version
34) after the resolver's own dispatch logic for these exact three
obligation types had already shipped, tested, in version 38; the runner now
compiles version 38, verified by replaying the real recorded run, which
gives all 11 a governed home, 2 resolved and 9 correctly queued for review,
with nothing that already resolved changing. Representations needed one
word added in two places: an UPREIT deal structure gives the target its own
operating partnership, which makes representations alongside it, and
nothing in the party-recognition code treated "the Partnership" as
belonging to either side; fixed in both places it needed fixing, which
unblocks at most one of the three items it touches, the other two being
temporal qualifiers correctly routed to open world by an existing,
deliberate design rule rather than a bug. None of these three fixes has
been re-confirmed by a fresh, paid model call against the corrected code;
what confirms them today is replaying the already-recorded run through the
corrected, real resolver and vocabulary, which is real evidence but a
different kind of proof from a fresh run. The rest of the 193 are, for the
most part, correctly left alone: real design work needing new claim types
(consideration, proxy meeting), genuine judgement calls named for Ben
rather than guessed at, or defects diagnosed and specified precisely that
sit in `candidate-resolution.js`, a file none of this work was permitted to
touch. Full per-item accounting:
`docs/codex-program/notes/open-world-ownership.md`.

**What this does not yet prove.** A per-run call timeout is now
configurable rather than fixed at ten minutes, after capitalisation's own
definitions section ran long and was killed by the old default (commit
`ae8b12de`). Separately, the same commit checked directly against the
source and confirmed that guaranty returning nothing for Modiv is correct:
this is an unfinanced REIT merger with no financing-party protections in
the text, not a mapping failure. Neither of these changes the central
caution: this sweep ran against one agreement. The recommended next check,
running all 25 families again against a second, differently-drafted deal
(TopBuild, a financed transaction the Modiv-tuned fixes were never tested
against) to see which fixes generalise and which were tuned to Modiv's own
drafting, has not been done (`docs/codex-program/HANDOFF-2026-08-06.md`).

**Technical.** `scripts/canonical-v2-live-extraction-run.mjs` (renamed from
`scripts/canonical-v2-modiv-termination-fee-scope-correction-run.mjs`,
history preserved with `git mv`, once it became a general runner rather
than a Modiv-termination-fee-only one) dispatches any of the 25 registered
families against any pinned deal; `--dry-run` reports projected call count
and cost with no model call. Full measured totals, per family, with every
review-queue reason code and its count:
`docs/codex-program/notes/all-families-baseline-20260806.json`.

### P2. Widen the claim definitions where the diff says to

**What it is.** P1 showed V2 missing things V1 has. Decide which V2 should
learn, and teach it.

**Why it matters.** For termination fees, V2 governs three facts where the
table shows about twelve. Extracting more deals does not fix that.

**Decided.** The three legal rulings are made: willful breach gets two
rows, payment deadline becomes one claim per limb, and "fee required to
terminate" moves to Termination Rights. See `DECISIONS.md` items 4, 5 and 6
for the reasoning behind each.

**Technical.** Three of the nine gaps need no new definitions: sole remedy and
the willful-breach carve-out are already governed in the Remedies family
(`SOLE_REMEDY_LEGAL_EFFECT_PRESENT`, `SOLE_REMEDY_CARVEOUT_KIND`) and
projected with **zero consumers outside tests**; late-payment interest was
wired tonight. A genuine new definition costs 11 edits in
`lib/canonical-v2/contract-bundle.js` (watch the dual numbering: input at
V38, concept keys at V24), and still needs projecting and wiring into the
termination-fees switch before it reaches the review page; see P3. That
switch already exists and does not wait on any version limit.

A further gap, found and precisely scoped while building the per-limb amount
field above, is not one of the nine and is not yet built: nothing records
which termination grounds gate which limb's figure, so a reviewer still has
to read the underlying quotes to know that $10,000,000 attaches to three
grounds and $15,000,000 to the other two. Closing it needs a second per-limb
field naming the cited grounds, verbatim from the same sentence the amount
comes from, plus a resolver-side join against the trigger data: a slice at
least as large as the one just built
(`docs/codex-program/notes/per-limb-fee-amount.md` section 7).

### P3. The real serving path, and the rule for retiring V1

**What it is.** This step used to say: raise a limit on which contract
versions are allowed to serve, because that limit was what stood between V2
and a user. That was wrong. Nothing that actually runs in the product reads
that limit; raising it would have changed a number nobody consults.

What actually decides whether a family shows up is a small switch, built
once per family: extraction produces the facts, projection turns them into
rows, and the switch turns that family on for the review page, next to the
old system's version of the same row. That switch already exists and
already works, for one family, termination fees. Building the same switch
for each remaining family is P9's job.

What this step now covers is the other half of the question: when is a
family's new system allowed to stand on its own, with the old one no longer
shown beside it. Today the two always render together, as a temporary check
on the way to replacing the old system entirely, not as the finished
product. The rule for when that replacement is safe is below.

**Why it matters.** A more rigorous way of deciding what gets served was
designed and mostly built before this one, then quietly stalled without
anyone recording that it had. Left unrecorded, the next person to hit this
problem would either believe the old, wrong story about a version limit, or
rediscover the rigorous approach and start rebuilding it without knowing it
already exists. Neither is acceptable, so both the correction and the
history are written down below.

**Decided.** Ben ruled in favour of the cheap, already-working per-family
switch over the more rigorous approach, on one condition: a family's old
system is not removed from the review page until the equivalence harness
proves, on real data, that the new system agrees with the old one or is
demonstrably better. See `DECISIONS.md` item 13 for the full reasoning,
including why this beats the more rigorous approach.

**Technical.** `FIXTURE_SERVING_CONTRACT_FINGERPRINTS`
(`lib/canonical-v2/contract-bundle.js`, currently around line 5317) is not
imported anywhere under `pages/`. Its only consumers are the abandoned
certification chain below and `contract-bundle.js`'s own version-gating
tests; nothing live reads it, so raising it changes nothing a user sees.

What actually keeps Canonical V2 off in production is
`lib/canonical-v2/feature-flags.js`. Every `CANONICAL_V2_*_ENABLED` flag is
checked together with `isPermittedCanonicalV2Runtime()`, which is true only
on a Vercel preview deployment or genuinely local development, and false on
Vercel production or anywhere `NODE_ENV` is `production`, regardless of the
flag's own value. That is the "hard-off on two independent signals" named in
section 2.2: the flag, and this runtime check. Neither one looks at a
contract version.

The real per-family path, already built once:
`lib/canonical-v2/termination-fee-serving-source.js` is the server-side
per-family gate and card source; `components/review/table-configs/termination-fees.config.js`'s
`selectRows()` is the client-side switch and side-by-side render. P9 repeats
this shape per family.

Whether the tracking register used to measure P9's progress can actually
prove that switch is reached by a live user, as opposed to proving only that
the surrounding V1 machinery runs, is a separate, unresolved question; see
P9.

The abandoned, more rigorous alternative: commit `c0610635` (25 Jul 2026)
froze the fingerprint list at versions 1 to 5 in the same change that added
the no-shop schema. Two days later,
`docs/superpowers/specs/2026-07-27-metric-scoped-serving-admission-f22-design.md`
chose, instead of widening that list, a lane that admits one certified
metric identity at a time, reasoning that versions 1 to 5 were the original
hand-reviewed slice and nothing admitted since had equivalent scrutiny.
Eleven components were built against that design and remain in the repo,
real, substantial and passing, each with its own test: the F16 through F21
no-shop copy-delivery chain, then `metric-serving-admission.js` (F22),
`metric-scoped-candidate-release-f23.js`, `no-shop-timing-certification-f24.js`,
`no-shop-actions-certification-f25.js` and `no-shop-cross-view-release-f26.js`.
Its own "Planned increments" list named two things still to do after F26: an
explicit activation gate, and Material Contracts as a second family to prove
the approach generalised. Neither was built. Material Contracts shipped
instead through the ordinary path above (`material-contracts-product-projection.js`,
`material-contracts.config.js`), the same shape termination fees uses. **Do
not delete this chain and do not extend it.** It stays in the repo, complete
enough to read and deliberately unused, so a future need for per-fact
certification at that level of rigour does not get rebuilt from nothing.

**A step that was drafted here and removed, 2026-08-05.** An earlier version of
this plan added a step to capture V1's rendered output into the repository so
the equivalence harness would have something to diff against, and made it a
prerequisite for retiring V1. Ben rejected that outright: "I don't need V1. If
it was there, great, if not, forget it. I want to get V2 up and running, not
building V1."

He is right, and the reasoning is worth keeping so nobody reinstates it. V1's
data is not missing. It is live in the production database and rendering on
the site at this moment. What does not exist is a committed offline copy for
the harness, which is a convenience for an automated comparison, not a
precondition for anything a user sees. Turning that convenience into a gate
would have blocked the whole programme behind an access request nobody needs
to make.

So the harness stays a useful tool where it can be applied and is not a gate.
Where it cannot compare a family, that does not stop V2 serving or V1 being
retired. The judgement about whether V2 is good enough for a family is made by
looking at it, which is what the side-by-side view is for while it exists.

### P4. Fix the card-selection defect class

**What it is.** Five provision tables decide which cards belong to them partly
by searching the card's text for a phrase. That pulls other families' cards
into the wrong table.

**Why it matters.** One real corpus card leaks today: a buyer financing
representation appears as the evidence behind a termination-fee row. Worse
cases are reachable: a sole-remedy card landing in the fee table flips "Sole
and exclusive remedy" from No to Yes depending on card order.

**Done when.** All five tables refuse cards another family has claimed, and
each still catches genuine cards whose subtype was never set.

**Technical.** Fixed tonight in `termination-fees.config.js:71`. The same
unguarded `type || code || regex` shape remains in
`misc-boilerplate.config.js:176`, `antitrust-regulatory.config.js:22`,
`termination-rights.config.js:47`, `mae-definitions.config.js:46`.
`isTerminationRight` matches `/superior proposal/i`, which will pull no-shop
and fee cards. Narrow, do not delete: the fallback exists to catch genuine
subtype-less cards.

### P5. Record where every quotation came from

**What it is.** Store the exact position of every quote, not just its text.

**Why it matters.** It is the cheapest item in this plan, and it catches a
real, separate problem: a quote whose stored text is later changed while an
old, stale position is left in place beside it. **Correction, 2026-08-06.**
This entry previously said, in this sentence, that without this feature "a
quote that arrives already trimmed in a way that reverses its legal meaning
cannot be detected." That overstated what this feature does, checked
directly against `span-claims.js` itself
(`docs/codex-program/notes/negation-reversal.md`, section 7a): it runs
strictly after extraction, locating whatever text it is handed inside the
section it came from. If that text was already trimmed, in a meaning-
reversing way or otherwise, before this module ever sees it, the module will
find a real, self-consistent position for the wrong text and report nothing
wrong, because nothing about that position is actually wrong: it correctly
answers "where does this exact string sit in the section," which is a
different question from "was this string cut in a way that changed what it
asserts." The meaning-reversing trim this sentence originally had in mind
(dropping a governing "would not" from a materiality quote) was found live in
production and fixed directly, at the point a quote is accepted or rejected,
in `lib/verification.js` and `lib/canonical-v2/representations-dark-
bridge.js` (`docs/codex-program/notes/negation-reversal.md`); turning this P5
feature on does not touch that defect and was never capable of catching it.

**Technical.** `lib/parser-v2/span-claims.js` already does the job,
deterministically and with no model. It was gated at `extract.js:102` and the
options bag was never threaded through; both fixed tonight, still off by
default. Turning it on is one line each in `scripts/ingest-local.js:214` and
`lib/parser-v2/run-extract.js:181`, or `PM_SPAN_CLAIMS=1`. **Before
backfilling**, note that of 952 currently flagged sections, 470 are
stale-offset artefacts rather than hallucinations; backfilling now would
label them as fabricated quotes. Fix the attribution first. Separately, the
existing `primary_quote_start`/`primary_quote_end` columns are populated and
wrong; null them or mark them untrustworthy in the same change.

### P6. Reconcile claim identity, then certify the corpus

**What it is.** Fix the duplicate-row defect first, then run V2 across all 40
deals and check quality at scale.

**Why the order.** Claim ids are minted two different ways, so re-running a
previously backfilled deal creates duplicates instead of updating. A
corpus-wide run is exactly the trigger. Running first means cleaning up
after.

**Done when.** Re-materialising a backfilled deal is idempotent; then the
corpus runs clean against the ingest-QA gates, quote verification at zero
flags, and the golden evaluation harness.

**Decided.** Approved, identification first: the list of any affected
cards comes back to Ben before anything is deleted. See `DECISIONS.md` item
7.

**Technical.** Future writes were converged onto one scheme tonight; 128
cards may still carry legacy-scheme rows, unconfirmed without database
access. Corpus quality is stale and worse than the headline: as of 13 July,
18 of 40 deals fully clean, 66 coded provisions across 22 deals with no card,
13 deals failing soft gates. Both snapshots predate the V2 work. **No cost or
timing data exists** for a corpus run, because the subscription transport does
not retain usage fields. Budget blind and instrument the first run.
Checkpoints invalidate on a hash of the cleaned text. A per-type re-run of the
conditions family strips cited provision names unless `--allow-strip` is
passed.

### P7. Turn market statistics on, in preview

**Gated on lane S reaching S2.**

**What it is.** Switch the "what's market" comparisons back on, in the test
environment, with the two-scope sidebar Ben asked for.

**Why before search.** The machinery is more complete, the filters are already
built end to end, and the review page is where a user sees it.

**Decided.** Approved: the rule may be amended to un-contain the route,
applied when this step actually starts. See `DECISIONS.md` item 8.

**Technical.** Three stubs: `pages/api/market-stats.js`, `corpus-stats.js`
(641 lines, restore from `git show 8096bd6c^:`), `corpus-stats-batch.js`. Two
gates each: the route file and `lib/row-market-stats/handler.js:37`
`enabled = false`. `lib/service-client-route-actions.js:140` declares
`/api/market-stats` `ZERO_IMPORT`, and `:235` enforces that this implies
`HARD_CONTAIN`. Dual scope is nearly free: `calculateMarketStats` already
takes an arbitrary dataset, `normaliseFilters` already handles seven filters,
`buildMetricEntries` already accepts `allowedDealIds`. Add a `dealIds` filter
(~10 lines) and a filter control on the review page. **Do not rebuild the
derived-comparisons module**: `lib/canonical-v2/derived-comparison.js` exists,
passes 38 hostile tests, and is deliberately unconnected because a caller can
hand it self-authored trust records. Wiring it up without reading
`requireTrustFunction` is the hazard. **Risk: the cohort logic has never met
real data and its entire database reader has no test coverage**; the tests
inject an empty object as the client.

### P8. Turn search on, in preview

**Gated on lane S reaching S2.**

**What it is.** Switch the search tools back on, in the test environment.

**Why last.** It is a rewrite of seven routes, the load pattern that caused
the containment is unfixed, and the governing rule explicitly rejects the
guard that exists.

**Technical.** Fix the field registry **through its generator**:
`scripts/generate-query-serving-registry.js` writes
`lib/query/serving-registry-v1.json`, and `scripts/process-intelligence-baseline.mjs`
hash-pins it. Hand-editing the output passes a naive acceptance test and the
next regeneration reinstates all 104 errors. Acceptance: assert
`resolveKey(entry.key) === entry.key` across all entries, after regeneration.
Three query kinds survive, not five. Restore routes from
`lib/query/contained-routes/`; **the archived `saved-queries.js` will not
load** (imports never re-based when it moved a directory deeper, resolving to
`lib/lib/...`) and it fetches provisions unpaginated, truncating at 1000 of
~12,600 rows. A staged reopening is recommended: `kinds`, `demo-set` and
`field-options` without a field argument cost zero or trivial database work.
The 18 pinned demo-set expectations are baselined to a 2026-07-19 corpus and
will fail for unrelated reasons; re-baselining needs a human read of every
changed expectation.

### P9. Roll the remaining families

**What it is.** Repeat, for each remaining family, the same small switch
built for termination fees: extraction produces the facts, projection turns
them into rows, and a switch turns the family on for the review page next to
the old system's version of the same row.

**Why this is not twenty separate efforts, and why the obvious plan is
wrong.** The 103 surfaces still blocked today (104 before tonight) are not
twenty families' worth of bespoke work. Measured directly against the
tracking register rather than assumed, they are six kinds of work, of very
different sizes and very different owners:

| What actually blocks the surface | Count | Who does it |
|---|---:|---|
| The V2 module is built and correctly identified, but no product file has ever been given a line of code that imports it | 49 | Mechanical wiring, one recipe repeated per family: this is the real bulk of P9 |
| The underlying analysis or extraction has not been approved yet, so there is nothing ready to wire in | 32 | Legal and extraction review, a different skill entirely, not a serving problem |
| The tracking register still names a superseded component as its proof that the surface is visible | 13 | Twelve of these are really the wiring problem above, wearing the wrong label; one is a genuine naming gap, left blocked on purpose, see below |
| The tracking register is missing a line naming the module that already, genuinely, serves the data | 5 | A register correction, small, but proves less than it looks like, see below |
| No family or owner has been assigned yet | 3 | A triage decision, before any of the above |
| The real, provable route is a deliberately sandboxed one, governed by a standing ruling not to un-contain it early | 1 | Not a normal fix; wait for search to activate |

**The highest-leverage-looking fix was tried, and it cleared one surface, not
fourteen.** Fourteen surfaces across fifteen families all named the same
superseded component as their proof that V2 data reaches the screen, a
component nothing in the live product renders any more. Repointing all
fourteen at the component that replaced it looked like a single edit that
would clear fourteen blockers at once. It cleared one. Twelve of the fourteen
fail at an earlier, deeper check: the register also requires a real consumer
of the family's V2 module, and for twelve of them none exists, because
nobody has wired that module in yet. Fixing the component name for those
twelve would have asserted, falsely, that a user can see this family's V2
data, when no path in the product shows it, in either the single-deal view
or the comparison view. A thirteenth technically would have cleared too, but
was left blocked on purpose: unlike termination fees it has no server-side
switch behind it at all, only a preview-only tag Ben has already ruled does
not count as serving. Only the fourteenth, termination fee's own
comparison-view row, was genuinely just a naming gap, and it is now fixed.
So of the 49 the register already correctly calls a wiring problem and the
13 it currently blames on a stale component name: the true shape is 49 plus
12 that need the identical wiring work, one surface's naming gap that was
fixed and cleared, and one left showing as blocked on a stale name but kept
there deliberately, because the family behind it has no real serving switch
to wire into yet.

**The more important finding: the register can be fooled at scale, and this
has to be fixed before the per-family work runs, not after.** The tool that
decides whether a surface counts as visible works by tracing, file by file,
which code a live page actually imports, the same way you might follow a
paper trail through a filing cabinet. But the mechanism that actually decides
whether a user sees the old system's data or the new one runs on the server,
and reaches the screen only over a network response, never an import. No
paper-trail tool can see across that gap. The consequence is concrete and
already true today, not hypothetical: termination fees is the one family
proven, by a person reading the code directly, to serve V2 data live, and
even so, not one of its own registered surfaces actually traces through that
real mechanism, because nothing in its evidence names the server-side switch
or the route that calls it. Run the P9 recipe across the other families on
this register as it stands, and it will accumulate dozens of surfaces marked
visible that are real in the narrow sense that a served page really does
execute that code, while saying nothing about whether that code is showing
V1's data or V2's. That is a register that goes green while proving less
than the programme would read into it. Fixing this, either by requiring
every family to name its server-side switch as evidence and proving that is
reached, or by documenting plainly next to the register that "visible" means
the display plumbing runs live and not that V2 data is confirmed reaching a
user, has to happen before family-by-family wiring runs at scale, because the
count it produces is the only signal this whole step is measured by.

**What still needs doing, folded in rather than deferred.** Delete the two
dead projection modules once their families are otherwise resolved. Add
Capitalisation to the register; it has the most real recorded model output
of anything in the system and currently is not tracked at all. No-Shop needs
an architectural decision before it can join this recipe at all: it has no
projection module and still runs a separate, pilot-era pipeline. Rename the
`*-live-run/` directories that do not contain a live run, and, separately,
where a directory does contain a real run but a now-fixed defect mislabelled
some of its citations, regenerate rather than rename; see section 3.2.

**The success metric itself just got more trustworthy.** "The count falls"
is only meaningful if the thing counting it is honest. Two separate ways the
served-page check could over-report a route as live are now fixed: one,
converting a text-matching check to a real parser, already landed; the
second, a market-statistics route and a page whose every request redirects
before rendering anything, both previously counted as reachable when they
are in fact permanent stubs, is fixed as of tonight. Neither had yet caused a
wrong answer in the current count, confirmed directly by checking the
blocked-surface total before and after each fix and finding it unchanged,
but both were real and undefended before being closed. That does not prove a
third gap does not exist; it means the two specific ones already found are no
longer live risks.

**Technical.** Figures above from `docs/codex-program/notes/family-rollout-mechanics.md`
and `docs/codex-program/notes/compare-locator-fix.md` (commits `8167cf81`,
`024d953c`), reproducible directly:
`node -e "const {CURRENT_M3_FAMILY_PARITY_REGISTER,listM3ProductParityBlockers}=require('./lib/canonical-v2/native-producer/m3-family-parity-register.js');console.log(listM3ProductParityBlockers(CURRENT_M3_FAMILY_PARITY_REGISTER).length)"`.
The dead locator was `CompareSectionColumn` in
`components/review-v2/CompareColumn.jsx`, referenced nowhere but its own
definition; the corrected proof point is `UnifiedCompareSection`, same file,
what `pages/review/[id].js` actually renders. Repointed:
`termination-fee-query-fields` only. Left blocked on purpose and pinned by a
hostile test: `termination-rights-query-fields`. The HTTP-boundary gap: the
real V1/V2 switch for termination fees is
`isCanonicalTerminationFeeServingEnabled(reviewDeal)`
(`termination-fees.config.js`), fed by `attachCanonicalTerminationFeeServing`
(`lib/canonical-v2/termination-fee-serving-source.js`) via
`pages/api/review/[id]/cards.js`, joined to the client only by the wire
payload; zero of termination fee's eight registered surfaces name either file
as evidence. A candidate fix, described but not built: a new evidence shape
naming the wire field a serving-source function stamps, proven only if the
function is reached from the API route by the existing call-graph rule and
the client genuinely branches on that exact field name. The two exclusion-list
fixes: `MARKET_STATS_CONTAINED_ROUTE_FILES` and
`UNCONDITIONAL_REDIRECT_ROUTE_FILES`, both in
`lib/canonical-v2/native-producer/m3-family-parity-register.js`.

### P10. Improve the comparison view

**What it is.** Three things Ben ruled and that nothing currently owns: choose
which terms appear rather than always showing everything, remove the
three-deal limit with horizontal scrolling, and show source-completeness as a
column and a banner.

**Technical.** The limit is `MAX_COMPARED = 3` in
`components/review-v2/compareData.js`. Row identity for term selection already
exists as `unionRows` in `compareRowUnion.js`. The completeness state model
was built and committed; it needs a column and a banner, not a page. Export
to Excel and PDF is deferred until after launch on Ben's instruction.

---

## Lane D: delivery

D1, the merge to `main`, moved up: see the standalone section above, right
after the ordering correction. It is authorised and no longer waits on
anything in this lane. What remains here is D2 and D3, both still gated.

### D2. Import and go live

**Gated on lane S completing and on D1.**

**What it is.** Load V2 data into production without switching to it, check it
matches, then switch, with a tested way back.

**Decided.** Scope is the five-step path Ben set, not the documented
twenty-five: a real backup-and-restore drill, import to a copy the live site
is not reading, a comparison proving the two match, flipping the switch, and
a rollback someone has actually run. Go live when ready, with no external
customer forcing the date. See `DECISIONS.md` items 9 and 12 for the full
reasoning. What remains is building it.

**Technical.** **There is no cutover mechanism yet.** The objects the
documented twenty-five-step chain requires do not exist in code:
`ReleaseBundleEnvelope`, `PostActivationControlHead`,
`CandidatePromotionFence`, `GeneratedLockPlanRegistry` are zero files each.
There is no import, activation, rollback or restore script. Rollback has
been proven only as a database transaction rollback in staging; **no
production restore has ever been exercised**. Build the five decided
deliverables, in order: a backup-and-restore drill against the staging
project, actually performed (the cheapest real gate, roughly a day); an
import script writing to an inactive namespace with checkpointed resume; a
comparison proving the imported data matches; an activation switch,
smoke-tested immediately after; and a rollback script that gets actually
run, not just written, before D2 is called done.

**Addendum, 2026-08-06.** This section named the import script as missing
without saying what it should do. D4 and D5 below now give that design:
what the script writes, where it writes it, how re-running it stays safe,
how it is undone, and how it is built and tested by someone holding no
production credentials at all. Nothing above changes; D4 and D5 fill in
what this section left open.

### D3. The gate registry: ratified, and the catalogue reclassified

**What it is.** The 25 pre-production gates cannot be closed by design, and
most of the 289 mandatory adversarial tests are unimplemented prose specs.
Ben decided to keep the gates that map to real engineering and delete the
self-verifying layer that checked nothing, rather than build out either the
gates or the tests in full. That decision is now executed, not just decided,
and the count of implemented tests has one correction in it. This step
records both, and reclassifies what is left.

**Why it needed a decision.** Recommending "stop scoring the gates"
contradicted a manifest-pinned governed document. Left as an opinion it was
unactionable, so it needed a ruling and then a deletion step.

**Decided and done.** Keep the gates that map to real engineering; delete the
self-verifying layer that checks nothing. See `DECISIONS.md` item 10 for the
full reasoning. Commit `2396bf50` (2026-08-05) carried out both halves the
same day the decision was recorded.

**Technical, the live channel.** `lib/programme-gates/governing-registry.js:407`
still throws unless every gate's declared `state` stays `OPEN`; that is
deliberate and unchanged, so the frozen v2 contract stays byte-identical to
what was reviewed. What the same commit added is a second, computed field:
`computePreproductionGateStatus()` (from line 134) re-derives evidence live,
from primary sources, every time the registry loads, for exactly two gates,
`P1_CONTRACT_BUNDLE_COMPLETE` and `P1_VERTICAL_SLICE_PASS`. Confirmed by
running the registry directly: both report `computed_state: PASS` right now,
the first by recompiling the frozen M1 contract bundle twice and checking it
against the approved fingerprint and a hash-pinned acknowledgement file, the
second by re-validating the committed vertical-slice attestation against its
own tested predicate. Every other gate has no verifier registered and can
only ever report `computed_state: OPEN`, reason
`NO_MECHANICAL_VERIFIER_IMPLEMENTED`, by construction rather than oversight.
This is tested, including hostile cases:
`tests/programme-gates/governing-registry.spec.js` passes 30 of 30, run
directly, including "gate closure is fail-closed: no verifier can ever
launder an unverified PASS claim" and "gate closure falls back to OPEN, not a
thrown error, when a verifier disagrees with pinned evidence". Two gates have
their work finished and recorded as passed in
`docs/certification/programme-gate-status.json` too, an older, separate
tracking file; the live channel above is the one the code now actually
checks on every load.

**Technical, the deletion.** The self-verifying layer `DECISIONS.md` item 10
named for removal, `lib/programme-gates/p9-acceptance-*` plus a fifth module
deleted in the same change, `p9-definition-proposal-layer.js`, is confirmed
gone from the working tree: all 5 lib modules, their 4 test specs and the one
script that wrote their evidence. 1,001 lines by exact line count across the
5 modules, matching the figure `DECISIONS.md` already gives.

**The count, corrected.** Of 289 mandatory adversarial tests, **7 are
implemented and 282 throw "not implemented"**, not 8 and 281. Confirmed by
loading `lib/programme-gates/test-executable-registry.js` and counting how
many of its 289 `MANDATORY_ADVERSARIAL_TEST_IDS` return `IMPLEMENTED` from
its own `testExecutableState()` function. The drop from 8 is a correction,
not a new gap: the eighth, `PREVIEW-AUTH-01`, the one that had been counted as
covering authentication, was deliberately un-registered in the same commit
`2396bf50`, because it matched regular expressions against the source text of
a database credential-provisioning script and never issued a real request.
That is a point in the catalogue's favour, not against it: someone found a
decorative "implemented" label and removed it rather than leave it standing,
the day before this correction was written down. The 7 that remain are
registered against real test files, not regex-over-unrelated-source-text the
way `PREVIEW-AUTH-01` was, but their current file health is uneven and this
is the first place that says so. `P0-ROUTE-01` and `DEPLOY-CUTOVER-01` are
fully backed: every file the registry lists for them exists and passes when
run directly. `GATE-01` keeps 4 of its 10 listed files, `CONTRACT-01` 1 of
its 4 and `VERTICAL-SLICE-01` 1 of its 2; the rest were deleted by a
2026-07-30 governance-simplification commit (`afbf1a43`) that predates this
correction by six days. `GATE-BOOTSTRAP-01` and `REVIEW-CONTEXT-01` currently
list no file that still exists. What survives still passes, run directly, so
this is not a false "implemented" in the `PREVIEW-AUTH-01` sense; it is a
registry that stopped tracking which of its own listed files a later commit
removed, because nothing checks a bound file list against the filesystem.
Recommend adding that check, and revalidating the file lists for these five,
as a small follow-up; not done here, this step is documentation only.

**Would the other 282 have caught anything.** No. Checked against the five
real defects fixed in the two days before this was written, card-selection
leaking between review tables, a money parser taking the first number in a
string, an article heading swallowing the sections numbered after it, a
capability scanner matching source text instead of parsing it, and a quote
offset inverting an MAE qualifier by dropping "would not", none of the five
would have been caught by any of the 289 specs, implemented or not. Two have
a conceptual relative in the catalogue that operates at a different layer of
the system; three have no presence in it at all. The sharpest case: the
sectionizer responsible for the heading defect lives inside
`lib/canonical-v2/native-producer/`, exactly the code the catalogue exists to
cover, and no entry in it addresses where a section boundary falls. Every one
of the five was actually caught by an ordinary, co-located unit test against
the module that broke, not by the gate registry or the adversarial catalogue.
This is not an argument for building the 282. It says what they are for:
canonical-v2's formal identity, claims, release and import invariants, which
is a different layer from where this programme's defects have actually been
surfacing, legacy V1 rendering, numeric parsing, deterministic sectioning and
security-tooling correctness.

**The remaining 282 are a milestone-scoped backlog, not outstanding debt.**
The catalogue's own `GATE-01` entry states that the full 289-member catalogue
binds `PreCutoverCertification`, which is the M4 milestone, and only that
milestone. `EXECUTION-LEDGER.md` records `M4 pre-cutover` as `OPEN` and
`P9-CORPUS-CERTIFICATION` as `BLOCKED`, before M3, well before M4. So today
the 282 unimplemented tests are not, by the catalogue's own terms, a current
shortfall against anything this programme has reached; they become one only
if a status report cites the 289 figure next to a pass count outside M4
readiness. Do not build them out now: most of what they would need, a real
multi-deal canonical-v2 corpus, production import machinery and a live
cutover controller, does not exist yet and is not supposed to yet. Keep the
catalogue as a specification. Stop presenting the 289 figure next to a pass
count anywhere that is not about M4 readiness.

**The 23 still-open `P9_*` gates keep their own backlog, separately.** This
is a different 23 gates from the 282 tests above, and a different document.
`docs/codex-program/P9-ACCEPTANCE-DEFINITIONS.md` proposed a mechanical
acceptance definition for those gates. It was never adopted:
`programme-gates.yaml` is untouched by it, and it marks itself
`WITHDRAWN_NON_AUTHORITY` in its own first line. It stays in the repository,
not as authority and not as something to rebuild from nothing, but as a
graded starting draft: it reached materially the same conclusions as this
step, independently, and its own summary table is a reasonable order for
whoever formalises the next gate.

### D4. Build the import path and prove it, entirely offline

**What it is.** The extraction system produces a finished, checked set of
facts about a deal, a "write-set": the claims, the provisions they belong
to, the relationships between them, and the exact quotes that back them,
and saves it as a JSON file. Nothing then takes that file and puts it
anywhere the website reads from. This step builds the tool that does that,
and proves the tool works, on a database nobody else uses and that holds no
real credentials, so all of it can be built and tested before anyone needs
to touch anything real.

**Why it matters.** Most of the pieces already exist. The code that turns
facts into the rows a reviewer sees, the "projection" modules, is built and
tested for sixteen provision families. The database tables to hold the
facts are already designed, sitting unused in
`supabase/canonical-v2-foundation.sql`. There is even a database function,
`canonical_v2_write`, that already appears to know how to check a write-set
and insert it. What is missing is the connecting piece: a script that reads
a write-set file, writes it safely, and a matching piece that reads the
facts back out for a given deal and hands them to the projection code, the
way `termination-fee-serving-source.js` already does by hand for one deal
and one fixture file. That connecting piece is genuinely new work. Most of
what sits either side of it is reused, not invented here.

**Why this step needs nobody's permission.** Nothing here touches a real
database. It runs on a Postgres instance the person doing the work creates
and destroys themselves, the same way `npm test` runs without touching
anything real. It sits alongside steps P1 to P6 in this roadmap, work that
proceeds regardless of the security lane, because there is nothing here for
a permission boundary to apply to.

**Done when.** A validated write-set for a real deal can be imported into a
throwaway local database, read back out through a new, deal-agnostic
reader, run through the family's existing projection code, and rendered as
cards that agree with what the fixture-based version renders for the one
deal that already works today. A second real deal, with no hand-written
fixture file, renders correctly through the same path. Importing the same
write-set twice does not create duplicate rows. A write-set containing a
deliberately quarantined object, or an id that also appears in that run's
review queue, is refused, not silently dropped and not silently imported.
The whole import is undone by one command, proven by actually running it,
not merely by the command existing.

**Technical.**

**What gets written, precisely.** The import's input is what
`lib/canonical-v2/canonical-writer.js` already calls a `DEAL_SCOPE_RUN`
write-set: `source_references`, `deal`, and the arrays named in
`WRITE_ORDER` (`excerpts`, `provisions`, `claims`, `relationships`,
`components`, `condition_groups`, the four `open_world_*` arrays,
`semantic_impact_closures`, `reviewed_source_specific_rows`,
`incomplete_canonical_result_rows`). This is not the raw model output and
not the resolver's `resolution.json`; it is what remains after
`validateCanonicalWriteSet` and `validateResolvedCanonicalWriteSet`
(`lib/canonical-v2/validate-write-set.js`) have already split it into
`publishableWriteSet`, `residuals` and `quarantines`. Only rows in
`publishableWriteSet`, the ones carrying `publication_state: 'VALIDATED'`
(`lib/canonical-v2/claims-relationships.js`), are candidates for import. The
importer must call these same validators itself on whatever file it is
given, rather than trust the file's own claim to be already validated; a
file that fails validation is refused before any database call is made.
This is also how a quarantined object is excluded: it never appears in
`publishableWriteSet`, so an importer that only ever reads that field
cannot import one by construction. Prove the construction rather than
assert it: a hostile test that hand-builds a write-set with a quarantined
object spliced into the `claims` array must be refused, not silently
accepted.

**The review queue, kept out a different way.** Unresolved candidates live
in a separate artefact entirely, `RESOLUTION_REVIEW_QUEUE/V1`
(`lib/canonical-v2/native-producer/review-queue-artifact.js`), written by
the run driver and read today only by three human-triage scripts. It never
becomes part of a write-set, so it is excluded from import by the same kind
of construction as quarantine, not by a rule the importer has to remember.
Add one belt-and-braces check anyway: where a sibling review-queue artefact
exists for the same run receipt, confirm none of its item identities appear
among the write-set's claim ids before importing, and refuse if one does.
This turns "review-queue items cannot reach the importer" from an assumption
about upstream code into a tested property.

**What does not need to be built again.** `lib/canonical-v2/*-product-projection.js`,
sixteen modules, already turn resolved claims into the cards the review
page renders, each stamped with `canonical_v2_lineage` recording which
claim revisions back it. `termination-product-projection.js`'s
`projectTerminationFeeProductSurfaces` is the one already proven against
real, live-extracted text. This step does not rebuild that mapping; it
feeds it from a database instead of a hand-typed fixture. Two families have
no working projection at all, Merger Structure and Miscellaneous
Boilerplate (section 2.3 above calls them dead code), and one, No-Shop, has
no projection module and a separate architecture entirely (section 2.4).
Import machinery built here works for any family with a real projection
module and does nothing for those three; it should not be made to pretend
otherwise.

**Where it goes.** `supabase/canonical-v2-foundation.sql` already defines a
`canonical_v2_staging` schema with one table per write-set object kind
(`claim_revisions`, `provision_instances`, `relationship_revisions`,
`excerpts`, and the rest of `WRITE_ORDER`, plus `residuals`, `quarantines`,
`deals`, `deal_admission_records`, `write_receipts`), each row keyed by the
object's own content-addressed id, holding the row as `canonical_payload
jsonb` with a database-computed digest column for identity checking. This
is not a design choice left open; it already exists, unused. The owner's
own architectural ruling, ADR-001 in `OPERATING-RULES.md`, forbids,
absolutely, ever writing Canonical V2 data into the legacy tables,
`public.provision_cards` or `public.claims`, in the flattened shape the
four "dark bridges" use for preview only: "Flattened cards must not be
written to the production card table, the claims table, or any other
persistent store, ever." That destination is closed by standing ruling, not
by this step's own judgement. `canonical_v2_staging` (or a same-shaped
schema kept out of `public`, for any later, real project) is the only
destination consistent with that ruling, because native serving reads the
new system's own claims and provisions and projects them itself, exactly as
`termination-fee-serving-source.js` already does from a fixture.

**The writer.** The same file also already defines
`public.canonical_v2_write(p_environment, p_operation, p_idempotency_key,
p_input_digest, p_write_set, p_residuals, p_quarantines, p_receipt)`, a
`SECURITY DEFINER` function, meaning it runs with its own fixed database
privileges rather than the caller's, that independently recomputes each
object's content-addressed identity inside the database before inserting
it: the same defence-in-depth idea as `canonical-writer.js`'s own identity
checks, done twice, once in the application and once in the database, so a
bug in one does not silently corrupt the other. It appears complete for
`DEAL_SCOPE_RUN`. It has never been proven to run. The nine
`tests/canonical-v2-writer-*-identity-sql.test.js` files that reference it
check its source text for the right fragments in the right order; none
opens a database connection, confirmed by
`grep -L "new Pool\|\.query(" tests/canonical-v2-writer-*-identity-sql.test.js`
listing all of them. One neighbouring script,
`scripts/canonical-v2-staging-qxo-termination-fee.mjs`, says in its own
header that it has deliberately never called this function against a real
database. This step's first concrete task, before writing anything new, is
to stand up a throwaway Postgres, apply
`supabase/canonical-v2-foundation.sql` to it directly, and call
`canonical_v2_write` with a real, validated write-set, to find out whether
it works as its text implies. If it does, the import driver is thin: read a
write-set file, validate it, call the function once per deal, record the
result. If it does not, that is a real finding this step exists to
surface, and the fallback is a new repository class,
`PostgresCanonicalRepository`, implementing the same method contract
`InMemoryCanonicalRepository` already implements (`getReceipt`,
`transaction`, `writeObject`, `writeDeal`, `writeReceipt`, and the rest), so
`canonical-writer.js`'s own, already-tested orchestration logic stays
unchanged and runs against real tables instead of an in-memory object.
Either way, no new orchestration logic should be needed, only a repository
adapter.

**Idempotency, identity and checkpointed resume.** Every write-set object's
id (`claim_revision_id`, `provision_instance_id`, and the rest of
`OBJECT_ID_FIELDS` in `canonical-writer.js`) is content-addressed: the same
fact, extracted the same way, produces the same id every time, never a
random one. `canonical-writer.js` already uses this for safe replay: a
write under an `idempotencyKey` already bound to the same content is a
no-op returning the original receipt; the same key with different content
is a hard failure, never a silent overwrite. Reuse this exactly, one
write-set (one deal, one family, one run) per idempotency key. Checkpointed
resume, named as required by this step's own D2 entry above and by
`EXECUTION-LEDGER.md`'s `P10-PRODUCTION-IMPORT` milestone, follows from
this at little extra cost: a driver that processes a directory of
write-set files in order, one at a time, and can be rerun from the top
after a crash, is safe, because every already-committed file replays as a
no-op and only the rest actually write. No separate checkpoint file should
be needed if this holds. Prove that it holds, with a test that kills the
driver mid-batch and reruns it, rather than assuming it from the design.

**Reversibility.** Reversal here is close to free, and proven anyway, as
rehearsal for the layer that matters: drop the throwaway database, and
separately, take one `pg_dump` before a run and prove `pg_restore` brings
back the exact pre-import state. This is D2's own first decided
deliverable, done here at no cost, which is how it stops being untested.
For any real database, later, the same content-addressed idempotency key
that makes a rerun safe also makes an undo precise: "delete every row
written under idempotency key K" is a well-defined, narrow operation, not a
guess. Write it as a companion `--rollback` mode taking the idempotency key
the import used, dry-run first, matching the exact convention already
established in `sql/qxo-reverse-f3/generated/` and
`sql/qxo-reverse-f4/generated/` (`09-rollback-dry-run.sql`, then
`10-rollback-apply.sql`, then `11-verify-rollback.sql`). Follow that
convention rather than inventing a new one; it already exists and nothing
here needs to improve on its shape.

**The read side, and its acceptance test.** Add one new, deal-agnostic
module, reading validated claims and relationships for a given deal out of
`canonical_v2_staging` instead of a fixture file, and returning them in the
same shape a `*-product-projection.js` module already expects, exactly what
`termination-fee-serving-source.js` does by hand for its one deal. Prove it
by wiring a second real deal into the termination-fee family through this
new reader rather than a hand-written fixture file, and rendering it on the
review page next to QXO/TopBuild.
`evidence/canonical-v2/modiv-termination-20260806` is real, extracted data
already in the repository; confirm its exact shape before relying on it,
since it was produced by a run this step did not perform, and several
extraction runs are in flight elsewhere at the time of writing, so check a
run has actually finished before treating its output as final. P1 above
named exactly this as the one piece of the proven family still missing:
"Connecting a second deal to the screen without hand-writing a new file for
it... is separate work and has not been done." This step is where that
gets done, for the underlying machinery only; wiring every remaining family
through it, and deciding when each one is ready to show a user, stays P9's
job, not this one. `scripts/review-parity-check.js`, the equivalence
harness P1 and P3 already built, is the existing tool for checking the
result agrees with V1; reuse it rather than writing a second one.

**Setting up the throwaway database.** No local Postgres or Supabase CLI
convention exists in this repository today; this step establishes one. The
plainest option, needing no account and no cloud dependency: run Postgres
in a local container, apply `supabase/canonical-v2-foundation.sql` directly
with `psql`, and point `pg` (already a dependency, `package.json`,
`^8.22.0`) at it with a connection string that never leaves the machine.
Record the exact commands used, so a colleague with no Supabase account can
reproduce the whole of this step from a clean checkout.

### D5. Rehearse the import against staging, for real

**Gated on D4 passing, and on an explicit answer to the open authorisation
question below.**

**What it is.** Once D4's tool works against a throwaway database nobody
depends on, this step runs the same tool against the one real, hosted
database this system already talks to for testing, the "staging" project.
It backs that database up, restores the backup somewhere else to prove the
backup is real, imports one real deal's data into it, checks the result
against the source file field by field, and then deliberately undoes the
whole thing, keeping a record that it was actually done rather than merely
written down as a plan. Nothing in this step touches the live product or
anything a user can reach.

**Why it matters.** `DECISIONS.md` item 9 records Ben's ruling that going
live needs five things, not the twenty-five a fuller design once called
for: a real backup-and-restore drill, an import into a copy the live site
is not reading, a comparison proving the two agree, flipping a switch, and
a rollback someone has actually run. This step is the first three of those
five, done against the real staging project rather than production,
because that is the only honest way to know the backup-and-restore drill
and the importer built in D4 actually work outside a throwaway sandbox. It
is not the fourth or fifth step. Flipping the switch and a production
rollback stay D2's own job, later, gated exactly as D2 already says.

**The authorisation question, stated precisely.**
`OPERATING-RULES.md`'s authority boundary lists "importing candidate data"
as prohibited under current authority, with no carve-out for it the way
running extraction was carved out by name. `DECISIONS.md` item 9 decides
what import should look like once it runs; read on its own words, it does
not say it may run yet, and D2 above gates its own "load the new data"
deliverable on lane S completing. This plan was briefed on the
understanding that import is authorised; set against the boundary and the
decision as written, that does not obviously follow, and this document
does not have the standing to resolve the tension on its own authority. So
this step is gated on an explicit, fresh confirmation, independent of lane
S: staging is not production, nobody outside whoever runs this reaches it,
and the reason lane S gates D2 itself, an unauthenticated production
route, does not apply here. What is missing is narrower and specific to
this step alone.

**Needs from Ben.** Confirm whether running D4's tool against the real
staging database, not production, is already covered by the authorisation
already given, or say what is needed. Recorded as the second open item in
Part 5 below.

**Done when.** A backup of the staging project exists and has been
restored to a separate location, with the restored data checked against
the source, not merely assumed to match. A real write-set, for a real
deal, has been imported into `canonical_v2_staging` on the staging project
itself, through D4's tool, unchanged. The imported rows have been compared
field by field against the source write-set file and found to agree. The
whole import has then been undone using the rollback mode D4 built, and
the undo has been verified by checking the affected tables are back to
their pre-import state, not assumed from the rollback command's exit code
alone. All four are demonstrated by a command actually run with its output
kept, per this programme's own standing rule that "a receipt must name its
exact command" (`OPERATING-RULES.md`).

**Technical.** Target `CANONICAL_V2_STAGING_DATABASE_URL`, the same
connection `lib/canonical-v2/serving-client.js` already validates the shape
of (host `aws-1-us-west-2.pooler.supabase.com`, role
`canonical_v2_preview.<project ref>`), so this step introduces no new
credential, only a careful use of one that already exists and that, per
`OPERATING-RULES.md`, only ever runs from Ben's own machine. Before any
import: `pg_dump` the relevant schema, restore it to a second, disposable
database, a Supabase branch created for this purpose and deleted
afterwards is the natural fit since branching an existing project needs no
new credential, and diff the two. Then run D4's importer, unmodified,
against the real project, for one real deal's write-set, the QXO/TopBuild
data already pinned in `termination-fee-serving-source.js` or the Modiv
data named in D4, whichever D4 last proved against. Compare imported rows
to the source file by loading both and asserting deep equality on every
field, not by checking row counts. Then run the rollback mode D4 built,
dry-run first per the `sql/qxo-reverse-f3/` and `sql/qxo-reverse-f4/`
convention, then applied, then verified, and keep the three SQL files and
their output as the record that this happened, the same shape those two
existing directories already use. Nothing in this step writes to
`public.provision_cards`, `public.claims`, or any table a live route reads;
`canonical_v2_staging` is not on the read path of anything in production
today, confirmed under D4 above, so an error here is recoverable by
construction, not merely by care.

---

# Part 5. What I need from Ben

Two items below are still genuinely open. Rows 2 through 12 were decided
by Ben on 2026-08-05 and have moved to the decided list beneath the table;
each keeps its original row number so it is still easy to trace back to
this document's steps and to the matching entry in `DECISIONS.md`.

A row asking for production read access, so V1's output could be captured for
the equivalence harness, was drafted here and removed on 2026-08-05. Ben
rejected the underlying step: the harness is a convenience, not a gate, and
turning it into one would have blocked the programme behind an access request
nobody needs to make. See the note under P3.

| # | Decision | Blocks | If it waits |
|---|---|---|---|
| 1 | **Check the live site requires a login, and whether the July database key was rotated** | S0 | The corpus may be reachable now |

**A second open item, added 2026-08-06, not yet in `DECISIONS.md` because it
surfaced while designing D4 and D5.** Whether running an import script
against the real staging database, not production, is covered by the
authorisation already given, or needs its own. `OPERATING-RULES.md`'s
authority boundary lists "importing candidate data" as prohibited under
current authority, with no staging carve-out the way extraction was named
by exception. `DECISIONS.md` item 9 decides what import should look like
once it runs; it does not, on its own words, say it may run yet. This plan
treats the two as not yet reconciled and gates step D5 on an explicit
answer rather than guessing one. Blocks D5 only. If it waits, D4 still
proceeds in full, since D4 touches no real database and needs nothing from
Ben.

**Decided, 2026-08-05.** Recorded in full, with reasoning, in
`DECISIONS.md`:

- **2, how the browser authenticates:** session cookie.
- **3, show V2 in place of V1, family by family:** granted.
- **4, willful breach, one row or two:** two rows.
- **5, payment deadline, per limb or verbatim:** one claim per limb, against
  the cheaper recommendation.
- **6, does "fee required to terminate" belong to Termination Rights:** yes,
  it moves there.
- **7, clear duplicate claim rows:** approved, identification first, the
  list shown before anything is deleted.
- **8, un-contain the market route:** approved.
- **9, is the full cutover chain proportionate:** no, the five-step path
  instead of the documented twenty-five.
- **10, fix the gate registry or stop scoring it:** keep the gates that map
  to real engineering, delete the rest.
- **11, original or amended terms for market comparison:** amended terms,
  labelled.
- **12, go live:** when ready. No external customer is waiting on a date.
- **13, cheap per-family serving pattern or per-metric certification:** the
  cheap pattern, gated by the equivalence harness proving parity before a
  family's old system is retired.

**Already granted, recorded so nobody re-asks:** running extraction across the
corpus (2026-08-05); the shape of the comparison and search product; the
per-family display approach; rendering V1 beside V2 rather than replacing it.

**Also decided, 2026-08-05, blocking nothing, recorded in full in
`DECISIONS.md`:** materiality ranks for the four remaining provision types,
approved, with Ben's objection to a fixed rank table recorded alongside the
approval; the four no-shop concepts, all approved; representation subjects
stay open indefinitely rather than ever closing; and the human-verified
status is named `DOCUMENT_TEXT_VERIFIED_AGAINST_SOURCE_BYTES`.

**What remains genuinely open.** Two items. S0's browser check, whether
`precedent-machine.vercel.app` requires a login and whether the July
database key was rotated: an action for Ben to perform, not a ruling for
him to make, and `DECISIONS.md` item 1 already recorded what happens once
the answer is known. And, new in this revision, whether D5's staging
import is already covered by an existing authorisation or needs its own: a
ruling for Ben to make, not an action for him to perform, and nothing in
`DECISIONS.md` has recorded one yet. Nothing else on this page is waiting
on a decision or a grant.

When authentication is switched on there will be one more, and it is
configuration rather than a decision: `AUTH_PASSWORD` and `SESSION_SECRET`
have to be set in the environment, and nothing authenticates until they
are. The gate fails closed without them, which is the correct behaviour and
also means it does nothing at all until someone sets them.

---

# Part 6. Risks, in order

1. **Merging to `main`.** Corrected 2026-08-06: this item previously
   described merging 287 commits and 910 files, never tested as a merged
   unit, as the open risk. That merge happened, three times, the most
   recent nine hours before this correction (see D1 above). The residual
   version of this risk is smaller: 12 commits of this session's own work,
   not yet merged, and D1 above records both what already landed and what
   is still outstanding.
2. **The evidence base is thinner than the register says.** One family has real
   committed model output. The first corpus run is the first honest
   measurement.
3. **There is no authentication**, and the same routes carry live write
   handlers. Severity depends entirely on S0's answer.
4. **The cohort logic has never met real data.** The code deciding which deals
   a lawyer may compare is tested only against an in-memory fixture, and its
   database reader has no coverage at all. Bites at P7.
5. **One in seven search fields returns the wrong term.** Bites at P8.
6. **There is no cutover mechanism and no tested restore.** D4 and D5 above
   now plan how both get built and proven, offline first and then against
   the real staging database. Neither has been run yet, so this risk stays
   exactly as open as it was until they are.
7. **Quotation provenance sits in three incompatible coordinate systems**, two
   of them populated with wrong values that read as right.
8. **No monitoring of any kind.** No error tracking, no health endpoint, no
   alerting. A production failure is visible only in platform logs.

---

# Appendix: current state, verified 2026-08-06

**Corrected 2026-08-06, same day.** This appendix's own numbers went stale
within the day they were measured, because commits kept landing after they
were taken; that is the general problem
`docs/codex-program/notes/doc-reality-audit.md` was commissioned to find
(its finding F15 is this exact appendix). Every figure below carries the
command that produces it, per that audit's own recommendation, so the next
reader can re-check rather than trust a typed number.

- Test suite: **7718 tests, 7676 pass, 0 fail, 42 skipped**, exit 0. Measured
  by `CI=true npm test`, reading `$?` from the `npm test` command itself,
  never through a pipe to `tail`/`head`.
- Parity: **102 blockers**, down from 104. Measured by
  `node -e "const {CURRENT_M3_FAMILY_PARITY_REGISTER,listM3ProductParityBlockers}=require('./lib/canonical-v2/native-producer/m3-family-parity-register.js');console.log(listM3ProductParityBlockers(CURRENT_M3_FAMILY_PARITY_REGISTER).length)"`.
  The earlier split of the total (73 finished-not-displayed, 27 not
  analysed, 3 unowned, 1 route-blocked) predates the six-way breakdown in P9
  and P9 is the current account.
- Pre-production gates: 25 declared under `P1_*`/`P9_*` (2 P1, 23 P9;
  `grep -c "id: P9_" docs/codex-program/programme-gates.yaml` gives 23),
  every one declared `OPEN` in the frozen registry, by design, so the
  reviewed contract stays byte-identical. Separately, `governing-
  registry.js`'s live overlay re-derives fresh evidence for 2 of the 25
  (`P1_CONTRACT_BUNDLE_COMPLETE`, `P1_VERTICAL_SLICE_PASS`) on every load;
  both currently compute `PASS` (`docs/codex-program/EXECUTION-LEDGER.md`,
  entry "D3 ratified", has the method and a runnable check). See
  `docs/certification/programme-gate-status.json`, corrected 2026-08-06,
  for the fuller account of why this file, `programme-gates.yaml` and
  `governing-registry.js` can look like they disagree.
- Corpus: 40 deals, last quality snapshot 13 July, 18 fully clean. Not
  independently re-verified for this correction.
- Real V2 model output: grown substantially since this line was last true.
  All 25 registered families have now been run live against Modiv in one
  sweep (58 model calls, $20.30), pinned as a baseline at
  `docs/codex-program/notes/all-families-baseline-20260806.json`; see the
  P1 addendum above for what that found and fixed. This is still one
  agreement; a second, differently-drafted deal has not yet been run
  through the same sweep.
- Branch `codex/m3-production-phase1`: the 287 commits and 910 files this
  line used to describe were merged to `main` on 2026-08-05 and
  2026-08-06, across three pull requests (#476, #477, #478; see D1 above).
  The branch is now 15 commits ahead of `origin/main` again
  (`git log --oneline origin/main..HEAD`; run it fresh, this branch has
  moved twice already while this appendix was being corrected), pushed,
  tree clean.
