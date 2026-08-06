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

143 tracked surfaces, 104 blocked.

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

**Turning search and market back on clears one of the 104.** Not fifty-three.
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

## D1. Merge to main: authorised, moved up

**Ben authorised this on 2026-08-05 and wants it moving now: he does not
want to keep developing on a branch.** It no longer waits behind anything
else in this plan; it runs in parallel with lanes S and P, same as
everything else here that does not touch containment.

**What it is.** This branch is 287 commits and 910 files ahead of `main`,
with 314,632 lines inserted. Production tracks `main`. None of it has ever
passed CI as a merged unit.

**Why it matters.** Step D2 is unreachable without it, and this is
plausibly weeks of integration on its own. Treating it as ambient is how it
becomes a crisis, which is exactly why it is authorised now rather than left
for later.

**How it gets sliced.** Not decided here. A separate assessment is
establishing how to break 910 files into a mergeable sequence, recorded in
`docs/codex-program/MERGE-PLAN.md`. Read that document for the actual
slicing; nothing in this roadmap should be read as pre-empting it.

**Done when.** The branch is merged, CI passes on `main` as a merged unit,
and the deployed site is verified live rather than assumed.

**Technical.** The `phase-allowlist` CI job runs on pull requests and the
active phase's allowlist covers none of tonight's moved paths; it will fail
until amended. Run `npm test` plus `npm run build` on the merge result, not
just on the branch.

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

**Start here. It needs nothing from Ben and nothing from lane S.**

**What it is.** Take termination fees, run V2 extraction on the deals we have,
show V1 and V2 side by side on the review page, and read off every
difference.

**Why it matters.** This is the first honest measurement of whether V2 is
better than V1. Everything downstream assumes it is. Nobody has checked.

**Done when.** The side-by-side view renders for real deals, and there is a
written list of every field where V1 and V2 disagree, with a judgement on
which is right.

**Technical.** Built and committed: the per-family switch at
`components/review/table-configs/termination-fees.config.js` `selectRows()`;
side-by-side behind `CANONICAL_V2_TERMINATION_FEE_COMPARE`; the equivalence
harness at `scripts/review-parity-check.js`; real pinned source for
QXO/TopBuild in `lib/canonical-v2/termination-fee-serving-source.js`. Run V2
extraction for `TERMINATION_FEE`; the runner requires
`prompt_budget_split_preflights` and `max_model_invocations` in its manifest.
Retries are effectively off: the Codex path sets `maxRetries: 0`, the
Anthropic path allows two with no backoff. Acceptance: harness exits 0 or 1,
never 2 (which means coverage incomplete), and a human reads its report field
by field.

### P2. Widen the claim definitions where the diff says to

**What it is.** P1 will show V2 missing things V1 has. Decide which V2 should
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

**Why it matters.** Without it, a quote that arrives already trimmed in a way
that reverses its legal meaning cannot be detected. It is also the cheapest
item in this plan.

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

**What it is.** Repeat P1 to P3 for the other twenty families.

**This step gets its own plan once P1 proves the mechanism.** It is the
largest item here and specifying it now would be guesswork. What is known:
eleven families need only data and serving; four need real analysis work
(Material Contracts, No Other Reps, General Covenants, Representations, being
the 27); No-Shop needs an architectural decision, because it has no projection
module and carries a separate pilot-era pipeline. Also fold in: deleting the
two dead projections, adding Capitalisation to the register, and renaming the
eleven `*-live-run/` directories that contain no live run.

**Caution on the success metric.** "The count falls" is only trustworthy if
the instrument is. One over-report channel in the served-set check was closed
tonight by converting it to a real parser; a second remains, because the walk
models only query containment and so counts the market routes as served
despite being stubs. Close that before reading the count as progress.

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

**What remains genuinely open.** One item. S0's browser check, whether
`precedent-machine.vercel.app` requires a login and whether the July
database key was rotated: an action for Ben to perform, not a ruling for
him to make, and `DECISIONS.md` item 1 already recorded what happens once
the answer is known. Nothing else on this page is waiting on a decision or a
grant.

When authentication is switched on there will be one more, and it is
configuration rather than a decision: `AUTH_PASSWORD` and `SESSION_SECRET`
have to be set in the environment, and nothing authenticates until they
are. The gate fails closed without them, which is the correct behaviour and
also means it does nothing at all until someone sets them.

---

# Part 6. Risks, in order

1. **Merging 287 commits and 910 files to `main`**, never tested as a merged
   unit. The danger is not the raw count: most of those files are gated off
   in production, additive, or documentation. What is actually risky is
   whatever subset touches the live path, and how large that subset is is
   being measured, not assumed, as part of the slicing work in
   `MERGE-PLAN.md`. That does not make the merge safe; it narrows what is
   still unknown to a smaller, checkable question. D1 is now authorised and
   moved up in this plan (see above) precisely so this stops being owned by
   nobody.
2. **The evidence base is thinner than the register says.** One family has real
   committed model output. The first corpus run is the first honest
   measurement.
3. **There is no authentication**, and the same routes carry live write
   handlers. Severity depends entirely on S0's answer.
4. **The cohort logic has never met real data.** The code deciding which deals
   a lawyer may compare is tested only against an in-memory fixture, and its
   database reader has no coverage at all. Bites at P7.
5. **One in seven search fields returns the wrong term.** Bites at P8.
6. **There is no cutover mechanism and no tested restore.**
7. **Quotation provenance sits in three incompatible coordinate systems**, two
   of them populated with wrong values that read as right.
8. **No monitoring of any kind.** No error tracking, no health endpoint, no
   alerting. A production failure is visible only in platform logs.

---

# Appendix: current state, verified 2026-08-05

- Test suite: **7061 tests, 7020 pass, 0 fail, 41 skipped**, exit 0. Lint
  invariant 4 passes.
- Parity: **104 blockers** (73 finished-not-displayed, 27 not analysed, 3
  unowned, 1 route-blocked), **0 natively visible**, 443 served modules, 0
  unparseable.
- Pre-production gates: 25, none closed, none closeable while the loader
  forbids it.
- Corpus: 40 deals, last quality snapshot 13 July, 18 fully clean.
- Real V2 model output: 1 family as committed recorded responses, plus a
  12-item run across 11 families preserved tonight.
- Branch `codex/m3-production-phase1`: 287 commits and 910 files ahead of
  `main`, pushed, tree clean.
