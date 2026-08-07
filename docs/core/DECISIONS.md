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

**RULED 2026-08-07, later the same day, after adversarial review found the
split vocabulary already broken by a third agreement. Two further rulings,
both Ben's, both on his stated agreement with the recommendations.**

**A. `CONSUMMATION` is added as a fourth trigger event.** Skechers §8.3(b)(i),
filed text in this repository's own fixtures: *"the Company will
**concurrently with the consummation of such Acquisition Transaction** pay …
the Company Termination Fee."* That event is consummation alone and fits none
of the three ruled codes.

**Why the nearest code is not close enough to use.** Encoding it as
`EARLIER_OF_SIGNING_OR_CONSUMMATION` inverts a real term. Under QXO's tail the
fee is owed at **signing** of the later deal even if that deal never closes;
under Skechers it is owed **only at closing**. A signed-but-collapsed second
deal owes **$339.9M under one pattern and nothing under the other**. That is
not a rounding of vocabulary, it is a different answer to "does this company
owe the fee".

**B. Duration additions are pre-authorised, and the delay axis becomes
structured at V4.** Two parts.

*Pre-authorisation.* Decision 5 already said `payment_delay` is "zero, two
business days, **or whatever the agreement says**", and the implementation
froze `[NONE, TWO_BUSINESS_DAYS]`, dropping the third limb. Adding a duration
token is hereby **not** a codebook decision requiring Ben each time.
`OPERATING-RULES.md` reserves *taxonomy values and codebook vocabularies*
because those encode legal judgement. **A duration is a measurement, not a
concept**: "three Business Days" involves no reading of the agreement beyond
counting. Event codes stay reserved; delays do not.

*The structure.* `payment_delay` becomes `{count, unit, bound_type}` at V4
rather than a widened enum. This is what stops the same defect recurring a
third time:

- **"within three Business Days"** appears in this repository's own financing
  corpus and is ubiquitous in fee drafting. Under the frozen enum it fits
  nothing.
- **`bound_type` records a distinction that is currently invisible.**
  Skechers writes *"promptly (and in any event within two Business Days)"* and
  *"promptly, but in no event later than two Business Days"*. Those squeeze
  into `TWO_BUSINESS_DAYS` only if that code silently means *outer bound* — a
  semantics documented nowhere — and the promptness covenant is lost either
  way. An outer bound and an exact period are different obligations.

**The pattern this closes, stated because it has now happened twice.** A
vocabulary curated from one agreement broke on the second; the replacement was
curated from two and broke on the third, which was already sitting in the
fixtures. "All five real patterns encode" meant *adequate for the agreements
it was built from*. Structuring the axis that is genuinely mechanical, and
reserving only the axis that is genuinely conceptual, is what stops the fourth
agreement reopening this.

**Implementation: `PLAN.md` Step 3J2**, and it does not merge without the
Skechers case encoded from filed text rather than a typed string.

---

**RULED 2026-08-07: split the field. Option B.** Ben's decision on the
codebook question the update below raised.

`payment_timing` becomes **two fields**, not one enum:

- **`payment_trigger_event`** — what starts the clock: termination, the
  earlier of signing or consummation, or **concurrent with termination**.
- **`payment_delay`** — how long after it: zero, two business days, or
  whatever the agreement says.

**The defect this fixes.** The existing two codes conflate the two.
`TWO_BUSINESS_DAYS_AFTER_TERMINATION` encodes an event *and* a delay;
`UPON_EARLIER_OF_SIGNING_OR_CONSUMMATION` encodes an event and implies zero
delay. So Modiv's third pattern — the same event as the second code with a
different delay — has nowhere to go. A two-value enum curated from one
agreement was always going to break on the second, and adding a third code
would have left the next novel delay to reopen the question. Splitting is the
only option where the third agreement does not.

**The concurrency case is cross-checked, not merely added.** Modiv's
`7.3(b)(ii)` fee is payable when the Company terminates under `7.1(c)(i)`, the
superior-proposal fiduciary out, "prior to or substantially concurrently with
such termination". **That is decision 6's concept**, already ruled and already
modelled on the other side of the taxonomy as `feeRequired` on
`TERMR-SUPERIOR`: payment as a condition precedent to exercising the fiduciary
out, which decision 6 records as a materially different negotiating position
from "a fee is payable".

So the same fact is expressible in two families, and only one of them could
express it. **`payment_trigger_event = CONCURRENT_WITH_TERMINATION` and
`feeRequired` on the matching termination-rights row must agree**, and a
disagreement is a defect to surface rather than a preference to resolve
silently. Two sources of truth for one deal point is how a wrong reading
becomes invisible.

**Migration.** QXO's two stored values must be split into the new pair, not
left as legacy strings beside it. `allowed_payment_timings` is enforced at
`termination-fee-trigger-path.js:85`, and `contract-bundle.js` carries dual
numbering — input at V38, concept keys at V24 — so a genuine schema change
costs multiple coordinated edits there. See `CODEBASE-GUIDE.md` before
starting.

**What this supersedes.** The Modiv-only verbatim sidecar built under Step 3I
stays as the cited-text record, but it is no longer the eventual answer: the
coded fields are. Do not delete the sidecar when the coded path lands without
first checking that every branch's quote is still reachable.

**Update, 2026-08-07 (`PLAN.md` Step 3I).** The coded, general, per-family
`payment_timing` extraction this decision asks for still needs a live model
call and, separately, a codebook decision this task does not own:

> **Correction, same day.** The sentence above originally gave "no
> `ANTHROPIC_API_KEY` was available" as the reason the live call could not be
> made. **That is not a blocker and never was.**
> `scripts/canonical-v2-live-extraction-run.mjs` does not use an API key: its
> header says "No `ANTHROPIC_API_KEY` is assumed", and line 855 *deletes* the
> variable to force subscription auth rather than metered billing. It drives
> the model through the `claude` CLI as an external process, which is present
> in this environment. The genuine constraint is the codebook decision below,
> which a live call would not have resolved anyway.
>
> Recorded rather than quietly fixed, because "we cannot do X because Y is
> missing" is how this programme acquires false blockers, and Y here was
> disproved by reading the runner's own header. Modiv's own real drafting has three
distinct payment-timing patterns and none is an exact match for either of
the two existing `allowed_payment_timings` codes, which were hand-curated for
QXO specifically. What was built instead, scoped and documented as narrower
than this decision's eventual target: a Modiv-only sidecar
(`lib/canonical-v2/native-producer/modiv-termination-fee-payment-timing-
parser.js`, mirroring the pre-existing `resolveModivConditionalFees` sidecar)
that extracts each of Modiv's six fee-trigger branches' own payment-timing
text VERBATIM, cited, real, and proven against the real committed Modiv
replay -- not a coded enum value, and not built for any other deal. This is
real, per-limb, cited data today; it is not the "each termination-fee trigger
carries its own [coded] payment_timing field" shape this decision ultimately
wants. Full account: `docs/codex-program/notes/step-3d-3i.md`.

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

**All three were ruled on 2026-08-07.** They are kept here, in place, with the
ruling written against each, rather than moved to "Recently decided" — the
diagnosis and the answer belong together, and this section is where anyone
picking the work up will look for them. Nothing in this section is open.

| Question | Ruling |
|---|---|
| 1. Hosted read access to `canonical_v2_staging` | **Deferred.** Build the read half locally first, then bring Ben a recommendation. Standing action on the agent, below |
| 2. Whether open-world evidence is written at all | **Emit it, flagged.** Rows are written and carried as ungoverned evidence, distinguishable from governed claims |
| 3. `conditional_termination_fee_values` has no table | **Give it a table** |

Decisions 2 and 3 together set the ceiling on the read half. Before the ruling,
four of the ten cards a termination-fee run projects survived a round trip
through the database. **With both rulings implemented, all ten do.**

The three questions were found on 2026-08-07 while closing Step 2B's write
half. Each is diagnosed with evidence below. Ordered by what they block.

**Five were listed. Two were withdrawn the same day, on review.** Both were
work I had promoted to a decision — the specific-performance regex (item 2
below, already PLAN.md Step 3C) and the representation and covenant
vocabularies (already PLAN.md Step 3G, which locates them to a line, calls
them *"ordinary bugs, not design questions"*, and even predicts the symptom:
*"This is why the family resolved zero and put all 12 of its findings in open
world"*).

Both withdrawals are recorded rather than silently dropped — the
specific-performance one in full below, the vocabularies one in the paragraph
above. Promoting settled work to a decision is the same failure as declaring
built work missing: it stops the work and costs a round trip. It happened
twice in one night, so it is worth leaving visible.

**Numbering, stated because it has already gone wrong once.** The three live
items are numbered **1, 2, 3** below and the withdrawals are called out by
name rather than by number. An intermediate version kept the original numbers
with gaps, which left the handoff and this file pointing at different items
under the same label. If you find a reference to "decision 4" or "decision 5"
anywhere, it predates this note and means one of the two withdrawals.

**1. How the read half gets access to `canonical_v2_staging` in a HOSTED
environment.** `foundation.sql:8661-8665` revokes all table privileges from
every role including `canonical_v2_writer`, and RLS is enabled with zero
policies, so no hosted role can `SELECT` from `excerpts`,
`provision_instances`, `provision_components` or `claim_revisions`. Closing
that needs either a `SECURITY DEFINER` function or grants plus policies — a
change to the surface `lockdown-rls.sql` exists to police, which is why it is
yours.

**Corrected 2026-08-07, and it makes this less urgent than first written.**
An earlier version said this "blocks every rung of the ladder". It does not.
There is **no `FORCE ROW LEVEL SECURITY`** anywhere in the schema (zero
occurrences), so a **table-owner connection** — which is what Step 4A's local
Postgres container gives you — can `SELECT` freely. A local read-half
prototype was never blocked and is ordinary work.

So the better sequence is: build the read half locally against a container,
then bring you a working shape to decide the hosted access design against,
rather than a blank page. What is genuinely yours is the hosted design, and it
is not needed until something is served from a deployment.

**RULED 2026-08-07: deferred, on that sequence.** Ben accepted the deferral and
attached a standing action.

> **STANDING ACTION ON WHOEVER IS WORKING.** When the local read half is built
> and reading rows out of a container, decide the hosted access design —
> `SECURITY DEFINER` function versus grants plus RLS policies — with the
> working local shape as the evidence. Do not carry the local table-owner
> shortcut into a hosted environment by default: it works locally only because
> there is no `FORCE ROW LEVEL SECURITY` in the schema, which is an absence,
> not a design.

**RULED 2026-08-07 by Fable, under Ben's delegation. This decision is
closed.** Hosted read access to `canonical_v2_staging` is by **`SECURITY
DEFINER` functions granted to a new dedicated read role**. No table grants, no
RLS policies, no `FORCE ROW LEVEL SECURITY`.

**The mechanism.** Reads go through `SECURITY DEFINER` functions in `public`,
in a new additive `supabase/canonical-v2-staging-read.sql`, mirroring the six
reads the local prototype already performs. A new `NOLOGIN` role
`canonical_v2_staging_reader` is the only grantee; `EXECUTE` is revoked from
`PUBLIC`, `anon`, `authenticated`, `service_role`, `canonical_v2_writer` and
`canonical_v2_serving`. `search_path` is pinned on every function.
`canonical_payload` is returned verbatim, because the byte-identical
`canonicalJson` round trip is a product requirement. Results are bounded, so a
too-large read fails loud rather than streaming.

**`canonical_v2_serving` is deliberately not reused.** That role means "may
read activated corpus releases only" — the Step 5A gate. Granting it staging
reads would silently widen it to pre-release data. A separate role keeps each
role's meaning one sentence long, and retiring the surface later is a single
revoke and drop.

**Why this is the schema's existing law rather than a preference.** Verified
in the code, not inherited from the brief: **zero** `CREATE POLICY` statements
in any canonical-v2 SQL file, **zero** occurrences of `FORCE ROW LEVEL
SECURITY` anywhere in `supabase/`. Definer-function-plus-dedicated-role is
already the schema's only access idiom, applied twice — the writer, and the
Step 5A serving layer. This extends it to a third role. Grants plus policies
would introduce the schema's first-ever policies and first-ever table grants,
a second idiom for every future audit to police.

**Why grants plus RLS is worse for this product specifically.** Three reasons,
in order of weight:

1. **It cannot express the boundary that matters.** The governed/ungoverned
   distinction lives *inside* `canonical_payload` jsonb, not in a column. A
   `SELECT` grant exposes every row in arbitrary query shapes; a policy narrow
   enough to matter would reimplement `open-world-evidence-serving.js`'s
   semantics in the database — the duplicated-predicate drift that produced
   the QXO false-"Governed claim" defect found the same day.
2. **It destroys a cheap audit.** Today "is staging locked down?" is a
   zero-row check. With policies it becomes "read these predicates and reason
   about them". This project's documented failure mode is confidently
   misreading its own artefacts, so a mechanical answer is worth more than the
   flexibility.
3. **The obvious grantee is the wrong one.** The app's 19 service-key routes
   hold `service_role`, which is deliberately excluded from everything in
   `canonical_v2_staging`. Granting it `SELECT` would collapse the isolation
   that currently makes a leaked service key worthless against canonical data.

**What it exposes.** `anon` and `authenticated`: nothing, unchanged. The
service key: nothing in `canonical_v2_staging`, unchanged. `canonical_v2_writer`:
unchanged, gains no read. The new reader credential: deal-scoped,
`document_hash`-parameterised, bounded reads. An attacker holding it can
enumerate extracted deal data — the same exposure class decision 1 above
already accepted — but cannot write, cannot reach `public`-schema tables,
cannot run DDL.

**`lockdown-rls.sql` does not change and is not weakened.** Both its
verification queries are `public`-scoped and stay zero-row true. The new file
carries its own verification block: zero policies for `canonical_v2_staging`,
zero table grants, and the enumerated definer functions with their sole
grantee — so the audit stays mechanical.

**The ungoverned-evidence dimension, which is why the mechanism was chosen as
much as anything.** The functions become the boundary, so they carry the
**positive** check: governed claims are returned only
`WHERE canonical_payload->>'schema_version' = 'CLAIM_REVISION/V1'`; open-world
functions return only rows carrying the marker. **A QXO-era
`NOVEL_CONCEPT_CANDIDATE/V1` row matches neither predicate and is returned by
neither function — invisible rather than mislabelled.** That is the two-grammar
trap that was broken by execution on 2026-08-07, closed in SQL as well as in
JS. Both sides of the wire enforce it, and **a drift test is mandatory**: a
hermetic test reads the committed SQL and asserts its literals equal the JS
constants, so the two boundaries cannot separate silently.

**What this ruling does NOT authorise.** Design only. Not applying the SQL to
any hosted database, not creating or binding any login, not using any real
credential, not production activation, and no change to
`isPermittedCanonicalV2Runtime`'s denial of production. The authority boundary
stands in full; deploying this surface is a separate act needing its own
authorisation.

**Implementation is `PLAN.md` Step 2B2.**

**AMENDED 2026-08-07. Ben delegated this decision to Fable.** The original
form of this action was "stop and give Ben a recommendation". Ben's words:
*"just do what you and Fable decide is best."*

**So the trigger no longer stops the work — it changes who decides.** When the
read half reads rows out of a container, the hosted design goes to Fable as an
adversarial design review, and Fable's verdict is the ruling. No pause for
Ben, no separate approval step.

**What the delegation does not extend to.** It covers the *design* of hosted
read access — which mechanism, and what surface it exposes. It does not
authorise touching a real database, using a real credential, or activating
anything in production; `OPERATING-RULES.md` still prohibits all three, and
this is a design decision taken in advance of any such act, not permission to
perform one. A hosted deployment remains a separate act needing its own
authorisation.

**Why this still gets a real review rather than a quiet choice.** The design
changes the surface `lockdown-rls.sql` exists to police, which is why it was
Ben's in the first place. Delegating it to the adversarial reviewer keeps the
scrutiny and removes the round trip. It does not make it a small decision, and
it must not be settled by whoever happens to be at the keyboard: it goes to
Fable, with the local prototype as evidence, and the verdict is recorded here.

The trigger is concrete: the first time something reads
`canonical_v2_staging` from anywhere that is not a local container. That is
Step 5A's territory, and Step 2B's read half is where the prototype comes
from.

**WITHDRAWN 2026-08-07 — the specific-performance premise regex. This was
mine, not yours.** It was listed here as a decision. It is not.

`anthropic-provider.js:1193-1194` demands the literal strings `irreparable
harm would occur` and `money damages would not be an adequate remedy`. Modiv
§8.8 says *"irreparable harm, for which monetary damages (even if available)
would not be an adequate remedy, would occur"*, and the grant is discarded —
so every agreement drafted with "monetary damages" silently loses its
specific-performance grant. The source-side check twelve lines above tests the
**same premise** and accepts `harm|damage`, `money|monetary` and an
intervening clause.

Two predicates written to test one premise, where the tolerant one already
encodes the accepted reading, is a **defect**. `OPERATING-RULES.md` reserves
taxonomy values and codebook vocabularies to you; a matching predicate is
neither. And PLAN.md **Step 3C already exists as the engineering step for
exactly this fix** — I promoted a planned step to a decision, which is the
same failure as declaring built work missing, and costs the same time.

It is ready work. Step 3C now carries the measurement it asked for, and its
original quote-scope hypothesis is refuted there. Two conditions on doing it,
both from Step 3C and neither softened: the fix is a loosening, so it ships
with a hostile test proving a non-operative acknowledgement is still excluded,
and the diff goes through adversarial review before it reaches you.

You may still want to see the diff, because it changes what the pipeline
extracts from every deal. That is a review, not a gate.

**2. Whether open-world evidence is written at all.** 275 open-world entries
across the committed baseline, zero rows written: the adapter lists all five
open-world collections as always-empty. Consequence: four of the ten cards a
termination-fee run projects have no database-backed equivalent, and families
whose output is entirely open-world write nothing at all. Either emit the
rows, or accept a database-backed render of governed claims only and say so on
the page. Defensible either way; not defensible to inherit it from a constant.

**RULED 2026-08-07: emit them, with a flag.** The rows are written, and each
carries an explicit marker that it is ungoverned evidence rather than a
governed claim.

What the flag is for: an open-world entry is a fact the model found that the
taxonomy has no slot for. It has not been corroborated against a vocabulary,
so it has not earned the standing of a governed claim, and it must never be
able to arrive at a product surface looking like one. The flag is what keeps
those two things apart once they share a database.

Three constraints follow, and none of them is optional:

- The marker is **on the row**, not inferred from which table it sits in or
  from a collection name. Anything that reads a row must be able to tell what
  it is holding without knowing where it came from.
- **The projection and serving layers must honour it.** Emitting the rows and
  then rendering them indistinguishably is worse than not emitting them,
  because it launders ungoverned output into apparent claims. A card built
  from open-world evidence says so on the page.
- **A test proves the two cannot be confused**, at the write boundary and
  again at the serving boundary. This is the same class of risk as the
  negation-reversal work: confidently wrong, correct-looking, no visible
  signal to the reader.

**4. NEW, 2026-08-07. `v1v2_comparison` is wired and cannot be evaluated.
Release it explicitly, or supply the data.**

Ben ruled on 2026-08-06 that two M3 auto-pass conditions must be evaluated
before Stage 2's first rung. Both are now wired at the runner's
`resolveCandidates(...)` call. `lexical_disagreement` evaluates. The other
cannot: `v1v2-comparator.js:557` strictly requires
`snapshot_identity_evidence` on the V1 snapshot, and **all three committed
fixtures lack it** — `modiv`, `skechers`, `topbuild`, each checked directly
rather than inferred. So it reports `NOT_SUPPLIED` everywhere.

That is the honest behaviour and it is why this is a question rather than a
bug. Supplying the evidence needs a real identity-issuance chain; fabricating
it is not an option, because the requirement is a deliberate control.

**The prerequisite anticipated exactly this:** *"If this is released rather
than done, Ben releases it explicitly, and every rung below states in writing
that the conditions were not evaluated. It does not lapse by being forgotten a
second time."* It was forgotten once already.

**The choice.** Release condition 1 explicitly, and every rung records that it
was not evaluated — the runner already writes this per run to
`run-manifest.json.m3_auto_pass_conditions`. Or issue the identity chain for at
least one snapshot so it can be exercised on real data.

**Not urgent, and it should not be silent.** Wiring condition 2 alone already
paid: replaying `modiv-no-shop` left the routing counts unchanged at 42
resolved but replaced `LEXICAL_DISAGREEMENT_NET_ABSENT` on all 42 claims with
real outcomes, and gave 25 review-queue items real disagreement excerpts. The
gate had been green on 42 claims it never examined.

**RULED 2026-08-07: option A. Ben releases `v1v2_comparison` explicitly.**

This is the explicit release the prerequisite required, made as a deliberate
act on a dated record rather than by omission. Stage 2 proceeds with
`lexical_disagreement` evaluating and `v1v2_comparison` not evaluated.

**What the release does not mean.** It does not retire the condition, delete
it, or mark it satisfied. The comparator stays wired and stays strict. The
moment a V1 snapshot carries real `snapshot_identity_evidence`, it starts
evaluating with no further decision needed — the release is about proceeding
without it, not about ceasing to want it.

**What every rung must carry, as the condition of the release.** Each run
records `m3_auto_pass_conditions` in its `run-manifest.json`, naming each
condition `EVALUATED` or `NOT_EVALUATED`, and the runner prints the same line
to stderr. A rung's evidence is not complete without it. This is what makes
the release visible in the artefacts rather than only in this file, and it is
the specific protection against a third disappearance.

**What was knowingly given up.** No regression check against the old system
while the ladder runs. Stage 2 asks whether extraction generalises across
families and documents; whether the new pipeline agrees with the old one is a
different question, and no rung depends on it. If a Stage 2 rung produces a
result that looks wrong in a way v1 comparison would have caught, that is the
cost of this ruling and it was accepted with the ruling.

**3. `conditional_termination_fee_values` has no table.** Two more of the ten
cards come from it, including the Modiv headline. It needs a home or an
explicit omission.

**RULED 2026-08-07: give it a table.** The headline number is the first thing a
user looks at, and a schema that cannot hold it is not finished.

The table is added to `supabase/canonical-v2-foundation.sql` in the shape the
existing per-object-kind tables use, and `public.canonical_v2_write` learns to
write it, with its identity recomputed in the database like every other object
kind. **Sequenced after Step 4A**, so the schema is proven to execute durably
before it is extended: extending an unexecuted schema means debugging two
unknowns at once.

---

# Recently decided

- **Extraction latency is model generation, and is irreducible. Measured
  2026-08-07 by Fable, at Ben's request.** This is a finding rather than a
  ruling, recorded here because it governs how the corpus run is scheduled.

  **Where the time goes.** Across all 69 live model calls in committed
  telemetry, regressing call duration on output tokens gives
  **duration = 4.3s + 8.23ms per output token, R-squared 0.993** — about 121
  tokens per second. Prompt size explains almost nothing independently
  (R-squared 0.385, collinear). Section byte length explains almost nothing
  (R-squared 0.106): a 54.7KB section produced fewer output tokens than a
  14.8KB one. Everything outside the model calls — fetch verification,
  sectioning, parsing, validation, writing receipts — costs **under 0.5
  seconds per run**. CLI process overhead is ~2.4s per call.

  **About 88% of billed output is invisible thinking.** 959,168 output tokens
  corpus-wide against roughly 117,000 tokens of visible final JSON. NO_SHOP's
  single 9.1-minute call: 65,008 output tokens, ~92% reasoning.

  **So per-call cost tracks how densely a provision reasons, not call count,
  prompt bytes or section length.** That explains the inversion that prompted
  the question: CONSIDERATION's three calls emit 34k tokens between them,
  while NO_SHOP's one call emits 65k. Three cheap generations cost less than
  one enormous one.

  **Two findings that outlive the latency question.**

  **NO_SHOP's 65,008 output tokens exceeded the model's 64,000 ceiling** and
  required CLI-side continuation. Dense families are brushing a hard limit,
  and no scheduling change fixes that.

  **Thinking volume is stochastic.** Capitalisation section 3.2 took 525s one
  day and over 600s the next — same section, same prompt, same model. The
  observed completed maximum is 542s, so **a 600s cap has no margin over the
  distribution it is capping.**

  **What is safely reducible, quantified.** Parallelising sections within a
  family saves **45.8 of 136.6 total call-minutes, 34%** — the section loop at
  `native-extraction-run.js:635` is sequential and the calls share no state.
  Parallelising families across the corpus is the lever that matters at 25
  families times 40 agreements. Eliminating fixed overhead entirely would save
  5.6%, and is not worth a transport change.

  **What was ruled out, with reasons rather than listed neutrally.** Cutting
  the thinking budget is the only lever that would make a dense call
  materially faster, and it is refused: the thinking concentrates on exactly
  the provisions with the densest legal machinery, and a plausible-but-wrong
  assertion is worse than none. Trimming requested output changes the product,
  not the transport. A faster model, same reason. Splitting big sections
  saves little, since thinking does not scale with input size, and destroys
  within-section cross-reference context.

  **Consequence for scheduling.** Budget **9 to 11 minutes per dense-section
  call** as a floor, set per-call timeouts at **1,200s or more**, and buy speed
  with concurrency rather than by asking for less. An API transport would not
  generate faster.

  **Ruling 2, token cost, same day. There is no lever here, and the money is
  not real.**

  **The dollar figure is notional.** `childEnv()` in the runner deletes
  `ANTHROPIC_API_KEY` — "force subscription auth, not metered billing",
  `canonical-v2-live-extraction-run.mjs:856`, verified. The CLI's self-reported
  $25.81 across all 69 committed calls **was never invoiced.** The real
  currencies are wall clock and subscription quota headroom, and every saving
  below is denominated in those.

  **What a call actually carries**, from a byte-exact prompt reconstruction
  whose digest matches the committed `prompt_digest` — the real prompt, not an
  estimate. The extraction prompt is **~6,000 tokens**: binding instructions,
  family instructions, controlled vocabulary, response shape, section text.
  The `claude` CLI wrapper around it is **~42,700 tokens**. So the packaging is
  **85 to 90% of all input tokens**.

  **The prompts are not bloated and not uniform**, which retires an objection
  raised against ruling 1. Family preambles vary tenfold, 310 to 4,811 tokens,
  so the regression had real variance — and ANTITRUST, with one of the leanest
  preambles, produced the corpus's second-largest thinking volume. There are no
  worked examples, no cross-family taxonomy dump, no prior-call context.

  **A controlled experiment settled it rather than more correlation.** Three
  live calls, the same byte-verified section prompt, varying only the wrapper:
  full CLI in the repo, empty working directory, and a stripped system prompt.
  **Output tokens within 2% and duration within 2% across all three.** Quotes
  byte-verified in every arm. **Context volume does not drive thinking.**

  **Nor does narrowing the ask help.** NO_SHOP used every assertion kind it was
  offered — all eight arrays populated, 61 assertions, nothing sent was wasted.
  CAPITALISATION is the reverse and kills the hypothesis anyway: a large
  preamble, few kinds, 16 assertions, and 58,867 output tokens that went into
  share-count arithmetic rather than into kinds that never matched. What you
  *ask* changes thinking; how many bytes you *send* does not.

  **So the only cuttable thing is the CLI wrapper, and it is worth nothing
  here**: 85 to 90% of input tokens, **$0 in real money and 0 minutes**, since
  these runs bill to subscription and the input side is not the latency. Its
  only value is quota headroom, if that ever binds. Two CLI flags would get
  most of it. Before ever shipping that, ten same-prompt live pairs across
  families, compared at the adapter level.

  **The extraction prompt itself: cut nothing.** At 1,500 to 9,000 tokens it is
  already near the minimum that states the ask and the guardrails — the
  evidence rule, the never-assert-a-negative rule, and each family's known
  failure modes. Trimming those trades precisely what this product refuses to
  trade.

  Experiment cost: 3 live calls, ~8.5 minutes, under Ben's standing
  authorisation. Nothing in the repository was modified.

  **A correction to this programme's own record, made in the same breath.** The
  "18.3 minutes, 14 calls" figure circulated during this investigation as
  belonging to `CAPITALISATION`. It does not. That run is
  `modiv-termination-fee-citation-following-20260806` — TERMINATION_FEE, where
  11 of the 14 calls are deliberate citation follow-ups. The manifest carries
  no family field and the gap was filled by assumption. **No 14-call
  CAPITALISATION run exists.** Its real record is one completed call at 525s
  and one killed at 600,300ms with zero calls completed, on the same section.


- **Live extraction runs no longer need to be asked for, one by one.** Ruled
  by Ben on 2026-08-07: *"you can run extractions without asking."*

  **What changed.** `OPERATING-RULES.md` has permitted extraction since
  2026-08-05, but the working convention on top of it was that a live run
  costs money, so each one should be a deliberate, separately-raised choice.
  The 2026-08-07 handoff put it plainly: *"any live extraction run — that
  costs money and should be a deliberate choice, not a warm-up."* That
  convention is now lifted. Cost is not the binding constraint; judgement is.

  **What it authorises.** Running the extraction pipeline against documents
  already committed to this repository, including live model calls, without
  raising each run first. The two families with corrected pins that have been
  waiting on a live call — `KEY_DEFINED_TERMS` on Modiv §8.12 and
  `CONSIDERATION` on §2.6 — can simply be run, as can `CLOSING_CONDITIONS`
  §6.2, whose "recorded response" is not a model response at all but a
  captured CLI status message.

  **What it does not authorise, because a permission to spend is not a
  permission to reach.** Not production data, not real credentials, not
  activating any route, not importing to a production database. All four stay
  prohibited by the authority boundary at the top of `OPERATING-RULES.md`, and
  none of them is an extraction run. Running extraction is a model call
  against a committed document; it touches nothing real.

  **What does not change.** Replay is still the default where a recorded
  response exists, because it is free and deterministic, and because Ben ruled
  on 2026-08-06 for a replay path over a tolerance policy precisely so that a
  gate comparing counts across runs is not measuring sampling noise. A live
  run is now permitted; it is not therefore preferable. Use one where replay
  cannot answer the question — a corrected pin with no recorded response, or a
  genuine question about what the model would say today.

- **Nondeterministic extraction gets a replay path, not a tolerance policy.**
  Ruled 2026-08-06, in conversation, and recorded here on 2026-08-07 because
  it was cited in two places and written down in none.

  **The problem.** Stage 2's ladder compares `resolved` counts across rounds
  and stops the line when one falls. Every re-run was a live model call with
  no pinned seed, so two identical runs could differ and the gate would be
  measuring sampling noise as regression. The two ways out were a replay path
  or a written tolerance — what size of delta counts as noise, how many
  confirmations a red gate needs, who decides.

  **Ben chose the replay path.** Correctly: a tolerance policy is a number
  someone has to defend every time a gate goes red, and the first flaky rung
  would have been resolved by whoever was at the keyboard.

  **Code.** `lib/canonical-v2/native-producer/provider-record-replay.js`, and
  `--record` / `--replay` / `--replay-from-run` in
  `scripts/canonical-v2-live-extraction-run.mjs`. The entire committed
  baseline was produced through it with zero model calls, which is also the
  proof it works.

  **What it does not settle.** Replay re-scores the resolver, validator and
  write-set builder against fixed model output. It says nothing about whether
  the model would answer the same way today; that is a live run and a separate
  question.

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
