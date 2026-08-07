# Decisions from Ben

As at 2026-08-05. Every item below, numbered and smaller alike, has now been
decided. Each entry keeps the original ask, why it mattered, and the options
considered, then records the decision and the reasoning behind it.

Cross-references are to stages and steps in `docs/core/PLAN.md`. They
previously pointed at `ROADMAP.md`, which is archived; the mapping used is
recorded in the commit that changed them.

---

## 1. The open site: DECIDED 2026-08-05, risk accepted

**Ben's decision: accept it, and fix it properly with real authentication at
PLAN Stage 7, Steps 7A-7B rather than paying for a platform stopgap.**

The free Vercel setting ("Standard Protection") only ever protects preview
deployments; protecting production requires Advanced Deployment Protection at
$150 per month. That is poor value for a single-user internal tool, and the
paid toggle would be a detour from the session-cookie authentication that
PLAN Stage 7, Steps 7A-7B has to build anyway.

**The reasoning, recorded so a future session does not quietly treat this as
solved or reopen it.** The exposure is read-only: the mutation surface is
closed by a module-load assertion at
`lib/service-client-route-actions.js:235-237`, and the four routes a July
review graded critical are contained stubs on `main`. Nothing can be written,
modified, deleted or ingested. What is readable is 40 public SEC filings plus
the extraction on top of them.

**What would change the answer.** Showing the product to anyone outside the
Vercel team, which is the point at which real authentication is required
regardless. Until then this is a known, accepted, bounded risk rather than an
oversight.

**One check never completed.** Whether the production alias is genuinely open
was inferred, not proven: an unauthenticated probe of a sibling project's
alias returned HTTP 200, and both projects carry the same setting. A definitive
test is opening the site in a private window while signed out of Vercel. Being
signed in makes a protected site look open to you.

**Code.** The module-load assertion is `assertServiceClientRouteActionInventory`
in `lib/service-client-route-actions.js`, and the specific throw is at lines
235 to 237: `if (descriptor.service_client_mode === 'ZERO_IMPORT' &&
routeAction.disposition !== 'HARD_CONTAIN') { throw ... }`. One caveat worth
recording precisely, since this whole decision rests on the mutation surface
staying closed: this function is not called anywhere in the running
application, only from `tests/service-client-route-actions.test.js`. It is a
real, tested invariant over the declared route inventory, checked on every CI
run, not a guard that fires when the server itself boots. What actually
refuses a write at runtime is each contained route handler's own code, not
this assertion; the assertion only guarantees the declared inventory cannot
mark a `ZERO_IMPORT` route anything other than `HARD_CONTAIN` without the
suite failing.

---

## 1a. Original context (superseded by the decision above)

**Status: confirmed open.** `precedent-machine.vercel.app` serves without a
login, and the database is configured behind it, so the corpus and the
extracted analysis are readable by anyone with the URL.

**What is not exposed.** Writes. The mutation surface is closed by a
module-load assertion, and the four routes a July security review graded
critical are contained stubs on `main`. Nobody can delete, modify or ingest.

**What is exposed.** Reading. The 40 filings are public SEC documents; the
extraction and analysis on top of them are the product.

**The fix.** Vercel dashboard, project `deal-corpus`, Deployment Protection.
Currently Vercel Authentication scoped "all except custom domains", which is
not covering the production alias. Set it to cover all deployments.

**Recommendation: do it now.** It is a platform toggle, not a code change. It
also takes authentication off the critical path, which is what allows the
product work to run in parallel rather than waiting weeks.

---

## 2. How the browser authenticates: DECIDED 2026-08-05, session cookie

**Blocks:** shipping authentication (PLAN Stage 7, Steps 7A-7B), which in turn gates import and
production activation.

**The problem.** A draft middleware exists on an unmerged branch and is inert
by default. It cannot be switched on, because every page in the app fetches
its own API routes from the browser and nothing sends a credential. Turning it
on as-is breaks the entire UI. That is why it was written in July and never
enabled.

**The options.**

*Session cookie.* A login page sets an HTTP-only cookie; the API checks it.
Standard, secure, and the browser sends it automatically so no page code
changes. Costs a login page, session storage and a user model.

*Backend-for-frontend proxy.* Pages call an internal route that holds the
credential server-side. No cookie infrastructure, but every client fetch has
to be rewritten to go through it.

*Ship a key to the browser.* Fastest. Also means the key is in the page
source, so it protects against nothing except casual access.

**Ben's decision: session cookie.** A login page sets an HTTP-only cookie and
the API checks it, chosen over the proxy and over shipping a key to the
browser because it is the only one of the three still correct if this
product ever gets a second user, and no page's code has to change: the
browser sends the cookie by itself.

**Technical.** This authorises PLAN Stage 7, Steps 7A-7B's build: a login page, session storage
and a user model. The existing draft middleware on `wp/api-auth-middleware`,
inert behind `API_AUTH_ENABLED`, is the enforcement point once the cookie
exists. See `PLAN.md` Stage 7, Steps 7A-7B for the route inventory and the acceptance
test.

**Code.** Built since the paragraph above was written; the mechanism it
describes is superseded, not current. There is no `API_AUTH_ENABLED` flag
anywhere in the repository any more. The real gate is `middleware.js` at the
repository root, with its decision logic in `lib/auth/gate.js`, and it fails
closed on a missing `SESSION_SECRET` rather than on a feature flag. Session
issuance and verification are `lib/auth/session.js` and `lib/auth/cookies.js`;
credential checking is `lib/auth/credentials.js`; the login page is
`pages/login.js`. See `COMPLETED.md` Step 0I for the full account and its
verification command.

---

## 3. Permission to show V2 in place of V1, family by family: DECIDED 2026-08-05, granted

**Blocks:** PLAN Stage 2, Step 2C onward. Nothing can move the count without it.

**What is being asked.** Permission to switch the review page from the old
extraction to the new one, one provision family at a time, starting with
termination fees, in preview only.

**What is already built.** The per-family switch, a side-by-side view showing
V1 and V2 together with a verdict on each row, and an equivalence harness
that refuses to report a pass when its coverage is incomplete. All behind a
flag that cannot evaluate true in production.

**Ben's decision: granted.** V2 replaces V1 on the review page one provision
family at a time, in preview, starting with termination fees. Because V1
stays visible beside V2 rather than being replaced outright, the failure
mode stays visible rather than silent: a field V2 has not extracted renders
amber as "not yet extracted" beside V1's value, never as though the
agreement were silent.

**Technical.** This authorises the per-family switch-over that `PLAN.md`
Stage 2, Step 2C onward depends on. The switch, the side-by-side view and the equivalence
harness described above are already built, gated behind a flag that cannot
evaluate true in production; this decision is the permission to use them,
family by family, in preview.

**Code.** The flags live in `lib/canonical-v2/feature-flags.js`:
`isCanonicalV2ReviewEnabled` and `isCanonicalV2QueryEnabled` both additionally
require `isPermittedCanonicalV2Runtime`, which is hard-denied whenever
`VERCEL_ENV` is a non-preview value or `NODE_ENV` is `production`, so the
"cannot evaluate true in production" claim is enforced in that one function,
not by convention. The side-by-side rendering this decision authorised for
termination fees is in
`components/review/table-configs/termination-fees.config.js`, the block
headed "Ben's ruling (2026-08-05): switch to real Canonical V2 data as it
lands, but keep V1 VISIBLE ON THE PAGE beside it", which is this decision
quoted back almost verbatim in the code that implements it.

---

## 4. Willful breach: DECIDED 2026-08-05, two rows

**Blocks:** PLAN Stage 3. This is a legal call, not an engineering one.

**The problem.** The termination-fee table shows a single row labelled
"Willful-breach exception". Underneath, the codebase carries two different
facts:

- a carve-out to the **effect-of-termination** rule, so liability survives
  termination; and
- a carve-out to the **sole-remedy cap**, so the fee is not the exclusive
  remedy where there was willful breach.

An agreement can have either without the other. They allocate different risk.

**What happens today.** The row is populated by whichever card the code sees
first, so which of the two facts a reader is shown depends on card order.
That is a live defect, not a design choice.

**The options.** Two rows, each labelled for what it actually is. Or one row
that names which carve-out it reports. Or one row that reports both and says
so.

**Ben's decision: two rows.** One row for the carve-out to the
effect-of-termination rule, so liability survives termination; a second row
for the carve-out to the sole-remedy cap, so the fee is not the exclusive
remedy. Each is labelled for what it actually is, rather than one row that
silently reports whichever fact the code happens to see first. They are
different questions a lawyer would ask separately, and the new claim
vocabulary already governs only the sole-remedy variant, so wiring it to the
existing single row would have silently narrowed what that row means without
changing its label.

**Technical.** Cross-ref PLAN Stage 3. The sole-remedy row already has governing
claims, `SOLE_REMEDY_LEGAL_EFFECT_PRESENT` and `SOLE_REMEDY_CARVEOUT_KIND`
(see `PLAN.md` Stage 3); the effect-of-termination row is the new work.

**Code.** Built. `SOLE_REMEDY_LEGAL_EFFECT_PRESENT` and
`SOLE_REMEDY_CARVEOUT_KIND` are defined in
`lib/canonical-v2/native-producer/sole-remedy-resolution.js`. The two-row
split itself is in `components/review/table-configs/termination-fees.config.js`,
`SCALAR_ROWS`: the row `willful-breach-effect` (label "Willful-breach
carve-out", scoped to source code `TERMF-EFFECT`) and the row
`willful-breach-sole` (label "Willful-breach carve-out to sole remedy", scoped
to `TERMF-SOLE`), each reading only its own scoped source rather than the
first card either happens to see, which is the exact defect this decision
describes. The file's own header comment records the same reasoning as this
entry, including the "Owner ruling (2026-08-05)" citation.

---

## 5. Payment deadline: DECIDED 2026-08-05, one claim per limb

**Blocks:** PLAN Stage 3.

**The problem.** I assumed a payment deadline was a number of days. It is not.
Real values across 32 deals are branchy prose keyed to which termination limb
fired. A representative one:

> within two Business Days after such termination in the case of (A),
> simultaneously with such termination in the case of (B), or concurrently
> with the consummation of the Takeover Proposal in the case of (i)

There is no single value to store.

**The options.**

*One claim per limb.* Each becomes a governed fact tied to the termination
ground it applies to. Genuinely useful: you could ask "which deals require
payment simultaneously with termination". Requires deciding which limb governs
which path, which is a reading of the agreement.

*One verbatim string.* Store the sentence, display it, do not try to structure
it. Cheap, honest, not queryable.

**Ben's decision: one claim per limb, against the recommendation.** The
recommendation above was the cheaper option, one verbatim string. Ben chose
the more useful and more expensive one instead: each limb's payment timing
becomes its own governed fact, so a question like "which deals require
payment simultaneously with termination" is answerable directly, rather than
staying buried in prose nobody can query.

**Technical.** Cross-ref PLAN Stage 3. This is real work, not reformatting: it
requires deciding which termination limb governs which payment path for
every deal, which is a reading of the agreement, not a mechanical split of
the existing string. Budget it accordingly; do not let an implementation
fall back to the cheaper verbatim-string shape to save time, since that is
the option Ben specifically turned down.

**Code.** Partly built, and the split matters. The per-limb shape exists:
each termination-fee trigger carries its own `payment_timing` field (an enum
constrained by `allowed_payment_timings` in `lib/canonical-v2/contract-bundle.js`,
labelled for display by `PAYMENT_TIMING_LABELS` in
`lib/canonical-v2/termination-fee-trigger-presentation.js`), which is the "one
claim per limb" structure this decision chose, not a single verbatim string.
But every occurrence found is in serving, query and presentation code
(`shared-serving-row.js`, `qxo-termination-fee-admitted-slice.js`,
`legacy-query-mapper.js` and similar), which per `COMPLETED.md` Step 0A is
hand-typed for the two deals currently served. No producer prompt or
resolver under `lib/canonical-v2/native-producer/` sets `payment_timing`, so
the reading-the-agreement work this decision calls "real work, not
reformatting" is not yet done: the shape is built, the extraction that would
populate it from a live model call is not.

---

## 6. "Fee required to terminate": DECIDED 2026-08-05, moves to Termination Rights

**Blocks:** PLAN Stage 3.

**The problem.** The field currently sits in the fee family. It means
something different from what its position implies: that **payment is a
condition precedent to exercising the fiduciary out**, not that a fee is
payable. The codebase's own registry already scopes it to the termination-
rights family and groups it under "Fiduciary out".

**Why it matters.** A wrong reading inverts a material deal point invisibly.
"There is a fee" and "you cannot terminate without paying it first" are
different negotiating positions.

**A complication.** 23 of 28 stored values are booleans and 5 are prose, so
whatever is decided must handle both.

**Ben's decision: move it to Termination Rights.** The registry already
scopes this field there, under "Fiduciary out"; the display is what had
drifted. Moving it corrects the reading: this is about whether payment is a
condition precedent to exercising the fiduciary out, not about whether a fee
exists.

**Technical.** Cross-ref PLAN Stage 3. 23 of 28 stored values are booleans and 5
are prose; the moved display must handle both.

**Code.** Built. The field is `feeRequired`, defined at
`lib/schema/features.js:6493` and already scoped there to
`provisionTypes: ["TERMR"], provisionCodes: ["TERMR-SUPERIOR"], displayGroup:
"Fiduciary out"`, which is the registry entry this decision's problem
statement refers to. The display now matches: it renders in
`components/review/table-configs/termination-rights.config.js`'s
`FIDUCIARY_OUT_CROSS_CUTTING_ROWS` (row id `fee-required`) and has been
removed from `components/review/table-configs/termination-fees.config.js`,
whose header comment records the same move and cites the same registry
scoping this entry does. As with Decision 5, this is a display-layer
correction: `feeRequired` does not appear anywhere under
`lib/canonical-v2/native-producer/`, so today's values still come from the V1
extraction path, not a V2 resolver.

---

## 7. Duplicate claim rows: DECIDED 2026-08-05, approved, identification first

**Blocks:** PLAN Step 6E, the corpus certification.

**The problem.** Claims were minted two different ways historically. A cleanup
step removed the older rows for 12,259 of 12,387 cards. **128 cards may still
carry duplicates**, unconfirmed because this session has no database access.
Future writes have been converged onto one scheme, so no new duplicates
appear, but a corpus-wide run is the thing that would surface the existing
ones.

**What is being asked.** Permission to identify and delete duplicate rows in
production data, if any exist. Read-only identification first, with the list
shown to you before anything is deleted.

**Ben's decision: approved, identification first.** Identify the duplicates
read-only, and bring the list back to Ben before anything is deleted.
Nothing is removed on the strength of a count alone.

**Technical.** Cross-ref PLAN Step 6E. Run the read-only identification query
across production data, confirm whether the 128 at-risk cards actually carry
duplicates (or how many do), and hold the deletion for a separate,
specifically-approved step once the list exists.

**Code.** `scripts/curation/prune-cards.js`. Dry-run by default and writes
nothing without both `--apply` and `--backup <path>`; `--backup` refuses to
proceed if the target path already exists or the dump fails, and it acts only
on cards explicitly named in a checked-in decisions file under
`scripts/curation/decisions/`, never on cards it discovers itself. That
matches this decision's "identification first, nothing removed on the
strength of a count alone" structurally, not just by description. Whether it
has been run against the 128 at-risk cards is not something this repository
records; a corpus-wide run is still what would surface them, per the problem
statement above.

---

## 8. The market statistics route: DECIDED 2026-08-05, un-contain approved

**Blocks:** PLAN Step 8A.

**The problem.** A rule in the codebase declares the market route permanently
contained, and it is enforced at module load rather than by convention:
`lib/service-client-route-actions.js:235` throws if a route marked
`ZERO_IMPORT` is not `HARD_CONTAIN`. Turning market statistics on means
amending that rule, which is a deliberate governance change rather than a
mechanical edit.

**Context.** The machinery behind it is substantial, roughly 6,700 lines, and
the hard part is genuinely solved: it refuses to compare deals across
mismatched denominators or unknown deal-value bases. But **it has never run
against real data**, and the module that reads the database has no test
coverage at all.

**Ben's decision: approved.** The rule may be amended to un-contain the
route. Apply the change when PLAN Step 8A actually starts, not before, and treat
the first live run against real data as the real test of the machinery
described above, because it is: nothing has proven it against real data yet.

**Code.** The rule is the same assertion Decision 1 above cites,
`assertServiceClientRouteActionInventory` at
`lib/service-client-route-actions.js:235` (the `if` clause; the `throw` is
line 236). Amending it means changing the market-statistics route's
`service_client_mode` entry in `SERVICE_CLIENT_ROUTE_ACTIONS`, in the same
file, from `ZERO_IMPORT` to whatever the un-contained mode is, not editing
the assertion itself. As of this audit that entry has not been changed: the
route remains declared `ZERO_IMPORT`, consistent with "apply the change when
PLAN Step 8A actually starts, not before".

---

## 9. The cutover: DECIDED 2026-08-05, the five-step path, not the twenty-five

**Blocks:** PLAN Stage 9, going live. This is the largest unscoped item.

**The problem.** The programme documents a 25-step production cutover chain.
Of the objects that chain requires, most do not exist in code at all: no
release envelope, no promotion fence, no lock-plan registry. There is no
import script, no activation script, no rollback script and no restore
script. No production restore has ever been exercised.

**The question.** Is that chain proportionate to a 40-deal internal corpus
with one user, or is a smaller path acceptable: import to an inactive
namespace, verify it matches, activate, with a tested rollback and a real
restore drill?

**Ben's decision: the five-step path, not the documented twenty-five.** Ben
delegated the judgement of which path to take, and confirmed the smaller
one, the same shape as the recommendation. He then fixed the floor himself:
five steps, and not one fewer.

1. Take a database backup and actually restore it somewhere else, to prove
   restore works. This has never been done.
2. Load the new data into a separate copy that the live site is not reading.
3. Compare the two and prove they say the same thing.
4. Flip the switch.
5. Have a rollback that someone has actually run, not just written down.

The documented chain was designed for a scale and an audience this product
does not have, and building it would be months. Nothing in it is being
declared unnecessary in principle: the ruling is that these five are the
proportionate substitute, and none of the five may be dropped to save time.

**Technical.** Cross-ref PLAN Stage 9. None of the objects the twenty-five-step
chain requires exist in code (`ReleaseBundleEnvelope`,
`PostActivationControlHead`, `CandidatePromotionFence`,
`GeneratedLockPlanRegistry` are zero files each), and there is no import,
activation, rollback or restore script today. Build against the five steps
above; fold a smoke test immediately after step 4 rather than treating it as
a separate, optional sixth step.

**Code.** Re-checked for this audit: still zero files for all four names.
`CandidatePromotionFence` appears once in the whole repository, inside a
regular-expression string in
`tests/programme-gates/query-release-contract-closure.spec.js`, describing
future behaviour, not a built class. This governs no code today; it governs
the absence of code, which is itself the finding the decision responds to.

---

## 10. The gate registry: DECIDED 2026-08-05, keep the real gates, delete the rest

**Blocks:** nothing operationally, but it distorts every status report.

**The problem.** All 25 pre-production gates read "open" and **cannot read
anything else**: the loader throws if any gate is not open. Two gates have
their substantive work finished and recorded as passed elsewhere, and remain
open purely because the code forbids it. Separately, of 289 mandatory
adversarial tests, 8 are implemented and 281 throw "not implemented". The one
covering authentication is regular expressions run against a script's source
text and never makes a request.

**Why it needs a ruling rather than a fix.** Recommending "stop scoring the
gates" contradicts a document that is byte-pinned and machine-read. Left as
an opinion it is unactionable.

**Ben's decision: approved.** Keep the gates that map to real engineering:
backup and restore, render parity, structured claims, security, import
parity and cutover. Delete the self-verifying layer, whose validator
compares its own output to itself and catches nothing. Every defect actually
caught in this codebase was caught by ordinary engineering, not by that
layer.

**Technical.** Cross-ref PLAN Stage 1.
`lib/programme-gates/governing-registry.js:267` is the loader that currently
throws unless every pre-production gate stays `OPEN`; it needs amending so a
gate can record a genuine pass. The self-verifying layer to delete is
`lib/programme-gates/p9-acceptance-*`, 1,001 lines across 5 modules.

**Code.** Both halves of this decision are now built; see `COMPLETED.md` Step
0K for the full account. The deletion is confirmed complete: `p9-acceptance-*`
and `p9-definition-proposal-layer.js` no longer exist anywhere in the
repository as code. The amendment landed as `computePreproductionGateStatus`,
line 134 of `lib/programme-gates/governing-registry.js`, which re-derives
`P1_CONTRACT_BUNDLE_COMPLETE` and `P1_VERTICAL_SLICE_PASS` from primary
sources on every load; every other gate still reports `OPEN`. One correction
to the paragraph above: the throw-unless-`OPEN` clause it cites at line 267
has since moved to line 407, because the amendment inserted the new
re-derivation logic above it in the same file (confirmed by `git show
2396bf50 -- lib/programme-gates/governing-registry.js`, a 132-line insertion
starting at the old line 15). The clause is unchanged, only its position; the
line number is not load-bearing but is stale as written. Separately, the
problem statement above says "8 are implemented and 281 throw"; `COMPLETED.md`
Step 0K, sourced from the same commit, corrects this to 7 and 282, because the
eighth test matched regular expressions against a script's source text and
was un-registered rather than counted.

---

## 11. Market comparison basis: DECIDED 2026-08-05, amended terms, labelled

**Blocks:** nothing before launch.

**The problem.** When a deal's termination fee is renegotiated by amendment,
market statistics have to decide which figure counts: what the parties first
agreed, or what they ended up with. Both are defensible. Mixing them silently
is not.

**Ben's decision: the amended terms, labelled.** What the parties ended up
with is what "market" usually means, but the statistic must say which basis
it used rather than leaving the reader to assume.

**Only one deal in the corpus is currently known to have an amendment**, so
this can wait until amendment parsing is built after launch.

**Code.** None. Searched for a basis label or an amended-versus-original
distinction anywhere market statistics touch, and found nothing: this
decision governs code that does not exist yet, consistent with the deferral
above. `market-stats.js` itself is also the contained route Decision 8
covers, so the earliest this can be built is after that route is
un-contained.

---

## 12. Go live: DECIDED 2026-08-05, when ready, no external trigger required

**Blocks:** everything, and it is last.

**Ben's decision: go live when ready.** His words, 2026-08-05: "Go live when
ready, there aren't a bunch of customers waiting for me." There is no
external customer and no deadline forcing the date. The product goes live
when the work above is actually done, not before, and not held back for any
other reason either.

**This is not the one-time authorisation to flip production, and must not be
read as one.** It settles that the decision is made in principle and that
timing is ours rather than driven by anything external. The act of switching
production over still requires Ben to say so at the time, against the state
of the work as it actually is then. An earlier version of this entry recorded
it as the explicit authorisation; that overstated what was said and is
corrected here rather than quietly amended, because a plan that grants itself
production authority is precisely the failure this programme exists to
prevent.

In any case it is not reachable until PLAN Stage 9 is, which is gated on lane S
completing and on D1 (see `PLAN.md` Stage 1, which Ben did authorise,
on 2026-08-05: "you can update the roadmap on these points and get things up
on main, I don't like living in branch land for ever").

**Correction, 2026-08-06.** This entry previously described D1 as blocked on
merging a single, still-pending branch of 287 commits and 910 files, never
tested as a merged unit. That merge happened, in exactly the shape
`MERGE-PLAN.md` proposed, in three pull requests: #476
(`wp/m3-canonical-v2-foundation`, merged 2026-08-05T21:55:41Z), #477
(`wp/m3-tonight-integration-and-live-fixes`, merged 2026-08-06T00:30:37Z) and
#478 (the whole `codex/m3-production-phase1` branch head, merged
2026-08-06T09:51:01Z), checked directly against GitHub (`gh pr list --state
merged`), not against another document. D1 is not, on that account, finished:
work on this branch continued after PR #478, and as of this correction the
branch is 15 commits ahead of `origin/main` again
(`git log --oneline origin/main..HEAD`; this moved twice more while this
entry was being corrected, run it fresh rather than trust the figure), not
yet merged. What changed is the
shape of what is outstanding: a small, fresh merge of this session's own
work, not the original 287-commit backlog, and D2 remains gated on lane S
regardless of either one.

**Code.** None; this is a scheduling and authorisation decision, and `D1`/`D2`
are labels from the archived `ROADMAP.md`, not gate identifiers in
`lib/programme-gates/governing-registry.js` (its gates use a different naming
scheme entirely, for example `P1_CONTRACT_BUNDLE_COMPLETE`). Re-checked for
this audit: `gh pr view` on 476, 477 and 478 confirms all three `MERGED` with
exactly the `headRefName` and `mergedAt` values above, and `origin/main` is
at `016288cb`, 15 commits behind `HEAD`, matching this entry's own caution to
run the count fresh rather than trust a figure.

---

## 13. How Canonical V2 gets served, and when V1 comes off: DECIDED 2026-08-05, the cheap per-family pattern, gated by the equivalence harness

**Blocks:** PLAN Stage 5 and, through it, every family Step 5E rolls out afterward.

**The problem.** Two different ways of deciding when a family's new system
is trustworthy enough to serve had already been built, separately, before
anyone asked which one the programme should actually use.

The first is rigorous: certify one fact at a time against its own reviewed
evidence, before admitting it. It was designed in detail and mostly built,
eleven real, tested components, for one family, no-shop. Its own plan then
called for two more things before anyone relied on it: a deliberate decision
to turn it on, and proving it worked on a second family, Material Contracts.
Neither happened, and nothing recorded that it had stalled.

The second is cheap: a hand-built switch per family that shows the new
system next to the old one. It already exists and already works, for one
family, termination fees.

**The question.** Which pattern does the programme standardise on for the
other twenty families: finish and extend the rigorous one, or keep building
the cheap one family by family.

**Ben's decision: the cheap pattern, family by family, gated by the
equivalence harness rather than by certification.**

**The reasoning, which matters more than the choice.** Ben clarified the
premise the question had been asked under: V2 is not meant to sit next to
V1 forever. It is meant to replace V1 entirely, and the side-by-side view
that both patterns would feed is a temporary visual check on the road to
that, not the permanent design.

That changes what the safety mechanism actually has to be. While both
systems render, a wrong value from V2 sits right next to V1's value with a
verdict on the page saying they disagree, so a mistake is visible the moment
it ships. Once V1 is gone for a family, that check is gone too. Whatever
catches a wrong V2 value has to live somewhere else by then, and it has to
be trusted enough to carry that weight alone.

**The rule this produces.** V1 is not removed for a family until the
equivalence harness proves, on real data across the corpus, that V2 says the
same thing V1 does, or demonstrably better. V1 is the oracle for that proof
while it is still on the page, and that is the last moment it can serve that
purpose: once it is gone, there is nothing left to check V2 against except
the harness's own prior verdict.

**Why this beats certification, specifically.** Certification tests a claim
against hand-authored fixtures, which tests it against whoever wrote the
fixture's belief about what the agreement says. The harness instead tests V2
against the extraction the programme has actually been relying on for real
deal work, which is a higher bar and a more honest one. It is also far
cheaper: the execution ledger already shows what certification-grade rigour
costs when something upstream changes. One converter fix, with no change to
any output, forced roughly 20 modules and 71 files to be re-pinned and broke
15 tests that needed hand-authored legal fixtures to fix. Twenty more
families are coming. That tax, paid once, is expensive; paid twenty times,
it is not affordable.

**Technical.** Cross-ref `PLAN.md` Stage 5. The rigorous chain
stays in the repository, real and passing, and is not being deleted: eleven
components built against
`docs/superpowers/specs/2026-07-27-metric-scoped-serving-admission-f22-design.md`,
F16 through F26 inclusive. It is not extended to any other family. The cheap
pattern's reference implementation is
`lib/canonical-v2/termination-fee-serving-source.js` and
`components/review/table-configs/termination-fees.config.js`; Step 5E repeats it
per family. The equivalence harness is `scripts/review-parity-check.js` (see
`PLAN.md` Stage 2, Step 2C). Where it cannot compare a family, that is an absence of committed V1 input, not a fault in it, and it does not gate retiring V1: Ben ruled on 2026-08-05 that the harness is a convenience and not a gate.

**Code.** A sample of the eleven F16 to F26 components, confirmed present and
distinct from the deleted `p9-acceptance-*` layer (`DECISIONS.md` item 10,
`COMPLETED.md` Step 0K, a different acceptance mechanism entirely):
`lib/canonical-v2/qxo-no-shop-copy-delivery-canonical-f19.js`,
`lib/canonical-v2/qxo-no-shop-copy-delivery-query-f20.js`,
`lib/canonical-v2/v12-serving-admission-readiness-f21.js`,
`lib/canonical-v2/metric-serving-admission.js` (F22) and
`lib/canonical-v2/metric-scoped-candidate-release-f23.js`. All exist and are
distinct files, none deleted.

---

# Smaller decisions, blocking nothing

Recorded so they are not lost. None of these was urgent, and all four are
now decided, 2026-08-05.

- **Materiality ranks for four provision types, approved.** Made Available,
  Ordinary Course, Material Contracts and General Covenants had never been
  ranked, and nothing had been invented for them in the meantime, correctly.
  Ben approved Material Contracts around rank 55, Made Available and
  Ordinary Course both near rank 66, and General Covenants last, ranked
  below all of them.

  **Ben's objection, recorded alongside the approval, because it matters
  more than the numbers.** A fixed priority table is evidence-blind: it
  settles a tie by rank even when the clause in front of it plainly belongs
  to a different family. The better design decides a tie by which family's
  defining language is actually present in the clause, and only falls back
  to the rank when the evidence is genuinely equal. This approval is an
  interim measure so the four families are unblocked now, not a decision
  that a fixed rank table is the intended end state.

  **Code.** Built. `MATERIALITY_TABLE` and `materialityFor` in
  `lib/canonical-v2/native-producer/candidate-resolution.js` carry the
  actual numbers: Material Contracts (`REP-T-CONTRACTS`) at rank 54,
  Made Available and Ordinary Course (`DEF-MADE-AVAILABLE`,
  `DEF-ORDINARY-COURSE`) both at rank 66, General Covenants at rank 95, the
  highest of any tier. Pinned by
  `tests/canonical-v2-approved-family-materiality-ranks.test.js` (re-run for
  this audit, passes). One live contradiction worth flagging:
  `docs/codex-program/OPERATING-RULES.md`, in its "Ben's legal and taxonomy
  rulings" section, still states these four "remain at rank 99 because no
  exact rank was ever approved. Do not invent one." That line is stale; the
  pinned test above is the current, enforced answer and should govern.

- **The four no-shop concepts, all approved:** Cease Existing Discussions,
  Change of Recommendation, Enforcement of Standstills, and Standstill
  Waiver / Don't-Ask-Don't-Waive. They existed in code, retained but with no
  recorded approval; that approval is now recorded, by moving the four from
  `unassigned_product_surfaces` into the NO_SHOP family's own
  `product_surfaces` (`EVIDENCE_ONLY`, matching their existing siblings)
  in `m3-family-parity-register.json`.

  **Checked:** it clears four of the six, not all six. The review-hold
  count fell from 6 to 2. The remaining two, NOSOL-SUPERIOR and
  NOSOL-INTERVENING, are unaffected: they sit on hold for a different,
  unrelated reason (`UNSUPPORTED_NATIVE_CLAIM_DOWNGRADED_TO_BOUNDED_EVIDENCE`,
  a permanently-bounded native-claim downgrade, not an unadjudicated
  approval question), and the owner has not ruled on them here.

  **Code.** The four surfaces are `nosol-cease-retained`,
  `nosol-enforce-retained`, `nosol-recommend-retained` and
  `nosol-waiver-retained` in `docs/codex-program/m3-family-parity-register.json`,
  now inside the `NO_SHOP` family's `product_surfaces`, disposition
  `EVIDENCE_ONLY`. The "review-hold count" is `review_hold_ids`, computed
  from `unassigned_product_surfaces` in
  `lib/canonical-v2/native-producer/m3-family-parity-register.js` (line
  1724). Its length is pinned at exactly 2 by
  `tests/canonical-v2-m3-certification-control.test.js`,
  `tests/canonical-v2-m3-certification-control-v2.test.js` and
  `tests/programme-gates/m3-family-parity-register.spec.js` (the last of
  these is titled "approved no-shop concepts are promoted from review hold
  to owner-approved family surfaces"), all three re-run for this audit and
  passing.

- **Representation subjects: stay open indefinitely.** The list does not
  close. It is designed to stay open-ended rather than work toward a fixed,
  closeable set.

  **Code.** None, deliberately. Searched for a closed representation-subject
  enum or constant across `lib/taxonomy.js` and the representations producer
  prompt and found none, which is consistent with this decision: the
  governed thing here is the absence of a closing list, not a list itself.

- **The document-verification status name:
  `DOCUMENT_TEXT_VERIFIED_AGAINST_SOURCE_BYTES`.** Chosen because it names
  document-level verification specifically, not corpus completeness, so a
  later completeness state can be added without colliding with it. This
  gets built into a permanent versioned record format, so treat it as fixed
  once real records start using it.

  **Code.** `lib/canonical-v2/source-verification-state.js`, line 196.

---

# Waiting on Ben

Five questions found on 2026-08-07 while closing Step 2B's write half. All
are diagnosed with evidence and none is started, because each changes either
what the pipeline extracts, what it writes, or the database's security
surface. Ordered by what they block.

**1. Grants or a reader function for `canonical_v2_staging`. Blocks the read
half, and therefore every rung of the ladder.** Nothing can `SELECT` from
`excerpts`, `provision_instances`, `provision_components` or
`claim_revisions` — `foundation.sql:8662-8665` revokes all table privileges
from every role including `canonical_v2_writer`, and RLS is enabled with zero
policies. The read half needs either a `SECURITY DEFINER` function or grants
plus policies. That is a change to the surface `lockdown-rls.sql` exists to
police, so it is yours. See PLAN.md Step 2B, read half.

**2. The specific-performance premise regex. Costs real extractions today.**
`native-producer/anthropic-provider.js:1193-1194` requires the literal strings
`irreparable harm would occur` and `money damages would not be an adequate
remedy`. Modiv §8.8 says *"irreparable harm, for which monetary damages (even
if available) would not be an adequate remedy, would occur"* — the premise is
plainly there, and the assertion is discarded. The source-side check twelve
lines above accepts `harm|damage`, `money|monetary` and an intervening clause;
the quote-side check accepts neither. Every agreement drafted with "monetary
damages" loses its specific-performance grant. Rubric semantics, so yours —
but the two predicates exist to test the same thing and disagree, which reads
more like an oversight than a judgement.

**3. Whether open-world evidence is written at all.** 275 open-world entries
across the committed baseline, zero rows written: the adapter lists all five
open-world collections as always-empty. Consequence: four of the ten cards a
termination-fee run projects have no database-backed equivalent, and families
whose output is entirely open-world write nothing at all. Either emit the
rows, or accept a database-backed render of governed claims only and say so on
the page. Defensible either way; not defensible to inherit it from a constant.

**4. The representation and covenant vocabularies.** `REPRESENTATIONS` (19 of
28 candidates) and `GENERAL_COVENANTS` (11 of 12) fail on corroboration tables
in `candidate-resolution.js` being narrower than what the producers
legitimately emit. Material taxonomy, explicitly yours.

**5. `conditional_termination_fee_values` has no table.** Two more of the ten
cards come from it, including the Modiv headline. It needs a home or an
explicit omission.

---

# Recently decided

- **The admitted-source identity stays as it is. The compressed source map
  is persisted instead.** Decided 2026-08-07 after an adversarial pass.

  As it stands, that identity embeds `source_map_compressed_sha256` — a
  SHA-256 of DEFLATE output (`lib/canonical-v2/sec-html-canonical-text.js:390`,
  pulled into the identity by `compactSourceMapLineage` at
  `lib/canonical-v2/sec-source-admission.js:76`). The compression parameters
  are pinned. The zlib build is not, and different builds emit different
  bytes for identical input at identical settings.

  So the same document, converted by the same code, yields **different
  `immutable_source_document_id`s on different machines**. That is not a
  content address. Measured on `evidence/canonical-v2/modiv-antitrust-20260806`:
  the uncompressed source map rebuilds byte-identically at 6,902,109 bytes,
  `source_map_digest` and `canonical_text_id` both match the committed run,
  and the compressed digest does not — unreachable at any of the 135
  available parameter combinations.

  The consequence is live, not theoretical: every extraction run made before
  2026-08-07 is unimportable in the current environment, and the writer is
  right to refuse them.

  **The fix considered and rejected.** Key the identity on
  `source_map_digest` — a `contentId` over the uncompressed structure,
  already computed and already stable. Rejected on blast radius, not on
  principle. That identity cascades into `source_occurrence_id`, which is
  embedded in **every excerpt row** and is a primary and foreign key in
  `supabase/canonical-v2-foundation.sql` (266, 366-382). The contract is
  **reimplemented in Postgres** — that file recomputes the id in SQL and
  enforces the exact V2 key set (2544-2603), mirrored in
  `sql/optionA/step0b-canonical-writer-by-contract.sql`. Around forty test
  files reference the contract and several fixtures pin exact ids. Rows
  already applied to staging under V2 ids would need migrating or be
  orphaned.

  **The fix taken instead.** DEFLATE *compression* is not deterministic
  across builds. DEFLATE *decompression* is — it is the standard's. So a run
  persists its compressed source map, and a rebuild adopts those bytes only
  after proving they inflate to the map it independently derived from the raw
  HTML. Same property, no contract change, no fixture regeneration, no SQL
  change.

  It is verification, not assertion: a payload that inflates to anything else
  is rejected, so persisting it cannot smuggle in a lineage the document does
  not support.

  It is also the only version that survives a **Node upgrade in place**.
  zlib ships inside Node, so recording the timestamp alone would have left
  the identity reproducible on this machine only until the next upgrade,
  which would strand every run directory made before it and recreate the
  loss just diagnosed.

  Payloads live under `evidence/canonical-v2/_admitted-source-map-payloads/`,
  content-addressed by `canonical_text_id`, so runs over the same document
  share one file rather than committing a copy each.

  **If a V3 is ever forced for other reasons**, drop
  `source_map_compressed_sha256` from the identity body then and keep it in
  the preparation receipt. Do not spend a migration on this alone.

  **Still true, and the standing rule.** Runs made before 2026-08-07 record
  neither their retrieval timestamp nor a payload, so they remain
  unimportable and are refused. Regenerate by replay — zero model calls. Do
  not re-derive `source_references` from a rebuild to make a run agree with
  itself; that is editing the evidence until it passes, and it does not even
  work, because `source_occurrence_id` is embedded in every excerpt row too.

---

# Already decided, recorded so nobody re-asks

- Running extraction across the corpus, 2026-08-05.
- The shape of the comparison and search product.
- Displaying V2 family by family rather than all at once.
- Rendering V1 beside V2 rather than replacing it.
- Export to Excel and PDF deferred until after launch.
- Amendment parsing deferred until after launch; detection ships before.
- The source-completeness admin page deferred; a column and a banner before
  launch.
