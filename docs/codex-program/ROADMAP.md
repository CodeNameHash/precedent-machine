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

**Nothing serves.** The serving layer admits contract versions 1 to 5, plus
one exception at version 12. Roughly 110 of the claim definitions live above
that ceiling. Registering a new claim definition costs eleven file edits and
buys nothing until the ceiling moves. **That policy is the real bottleneck,
not the claim vocabulary.**

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

**Eleven families are structurally complete and blocked only by data and the
serving ceiling**: Guaranty, D&O, Employee Matters, Financing, Tax, Key
Defined Terms, Antitrust, MAE, Proxy & Meeting, No Other Reps, General
Covenant Router.

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

All 25 pre-production gates read "open" and cannot read anything else: the
loader throws if any gate is not open. Two gates have their substantive work
finished and recorded as passed elsewhere and remain open because the code
forbids otherwise.

Of 289 mandatory adversarial tests, **8 are implemented and 281 throw "not
implemented"**. The one covering authentication is implemented as regular
expressions over a script's source text and never makes a request.

Every defect actually caught in this codebase was caught by ordinary
engineering: the served-set check, real end-to-end tests, adversarial probing
with the gate off. Step D3 proposes what to do about this.

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
V38, concept keys at V24) and is worthless until P3.

### P3. Move the serving ceiling

**What it is.** The serving layer accepts contract versions 1 to 5. Most of
the claim vocabulary is above that and cannot be served at all. Raise it.

**Why it matters.** Until this moves, no amount of extraction or definition
work reaches a user. It is the true bottleneck.

**Technical.** `FIXTURE_SERVING_CONTRACT_FINGERPRINTS` at
`contract-bundle.js:5319`; `metric-serving-admission.js:111` admits V12.
**Establish why the ceiling exists before raising it.** If it is a deliberate
freeze, that is a governance decision; if neglect, a one-line change with a
large blast radius. Do not raise it without knowing which.

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

### D3. Decide what to do about the gate registry

**What it is.** The 25 pre-production gates cannot be closed by design, and
281 of 289 adversarial tests throw "not implemented". Either fix the registry
so it can record progress, or stop scoring it and delete the parts that
verify nothing.

**Why it needs a decision.** Recommending "stop scoring the gates" contradicts
a manifest-pinned governed document. Left as an opinion it is unactionable, so
it needs a ruling and then a deletion step.

**Decided.** Keep the gates that map to real engineering; delete the
self-verifying layer that checks nothing. See `DECISIONS.md` item 10 for the
full reasoning.

**Technical.** `lib/programme-gates/governing-registry.js:267` throws unless
every pre-production gate stays `OPEN`. Two gates have their work finished and
recorded as passed in `docs/certification/programme-gate-status.json`. The
self-verifying layer is `lib/programme-gates/p9-acceptance-*` (1,001 lines
across 5 modules) whose validator compares its own output to itself.

---

# Part 5. What I need from Ben

Only one item below is still genuinely open. Rows 2 through 12 were decided
by Ben on 2026-08-05 and have moved to the decided list beneath the table;
each keeps its original row number so it is still easy to trace back to
this document's steps and to the matching entry in `DECISIONS.md`.

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

**Already granted, recorded so nobody re-asks:** running extraction across the
corpus (2026-08-05); the shape of the comparison and search product; the
per-family display approach; rendering V1 beside V2 rather than replacing it.

**Also decided, 2026-08-05, blocking nothing, recorded in full in
`DECISIONS.md`:** materiality ranks for the four remaining provision types,
approved, with Ben's objection to a fixed rank table recorded alongside the
approval; the four no-shop concepts, all approved; representation subjects
stay open indefinitely rather than ever closing; and the human-verified
status is named `DOCUMENT_TEXT_VERIFIED_AGAINST_SOURCE_BYTES`.

**What remains genuinely open.** One item: S0's browser check, whether
`precedent-machine.vercel.app` requires a login and whether the July
database key was rotated. That is an action for Ben to perform, not a
ruling for him to make, and `DECISIONS.md` item 1 already recorded what
happens once the answer is known. Nothing else on this page is still
waiting on a decision.

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
