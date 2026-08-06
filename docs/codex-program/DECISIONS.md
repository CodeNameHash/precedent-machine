# Decisions from Ben

As at 2026-08-05. Every item below, numbered and smaller alike, has now been
decided. Each entry keeps the original ask, why it mattered, and the options
considered, then records the decision and the reasoning behind it.

Cross-references are to steps in `ROADMAP.md`.

---

## 1. The open site: DECIDED 2026-08-05, risk accepted

**Ben's decision: accept it, and fix it properly with real authentication at
step S2 rather than paying for a platform stopgap.**

The free Vercel setting ("Standard Protection") only ever protects preview
deployments; protecting production requires Advanced Deployment Protection at
$150 per month. That is poor value for a single-user internal tool, and the
paid toggle would be a detour from the session-cookie authentication that
step S2 has to build anyway.

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

**Blocks:** shipping authentication (step S2), which in turn gates import and
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

**Technical.** This authorises step S2's build: a login page, session storage
and a user model. The existing draft middleware on `wp/api-auth-middleware`,
inert behind `API_AUTH_ENABLED`, is the enforcement point once the cookie
exists. See `ROADMAP.md` step S2 for the route inventory and the acceptance
test.

---

## 3. Permission to show V2 in place of V1, family by family: DECIDED 2026-08-05, granted

**Blocks:** steps P1 onward. Nothing can move the count without it.

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

**Technical.** This authorises the per-family switch-over that steps P1
onward depend on. The switch, the side-by-side view and the equivalence
harness described above are already built, gated behind a flag that cannot
evaluate true in production; this decision is the permission to use them,
family by family, in preview.

---

## 4. Willful breach: DECIDED 2026-08-05, two rows

**Blocks:** step P2. This is a legal call, not an engineering one.

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

**Technical.** Cross-ref step P2. The sole-remedy row already has governing
claims, `SOLE_REMEDY_LEGAL_EFFECT_PRESENT` and `SOLE_REMEDY_CARVEOUT_KIND`
(see `ROADMAP.md` step P2); the effect-of-termination row is the new work.

---

## 5. Payment deadline: DECIDED 2026-08-05, one claim per limb

**Blocks:** step P2.

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

**Technical.** Cross-ref step P2. This is real work, not reformatting: it
requires deciding which termination limb governs which payment path for
every deal, which is a reading of the agreement, not a mechanical split of
the existing string. Budget it accordingly; do not let an implementation
fall back to the cheaper verbatim-string shape to save time, since that is
the option Ben specifically turned down.

---

## 6. "Fee required to terminate": DECIDED 2026-08-05, moves to Termination Rights

**Blocks:** step P2.

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

**Technical.** Cross-ref step P2. 23 of 28 stored values are booleans and 5
are prose; the moved display must handle both.

---

## 7. Duplicate claim rows: DECIDED 2026-08-05, approved, identification first

**Blocks:** step P6, the corpus run.

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

**Technical.** Cross-ref step P6. Run the read-only identification query
across production data, confirm whether the 128 at-risk cards actually carry
duplicates (or how many do), and hold the deletion for a separate,
specifically-approved step once the list exists.

---

## 8. The market statistics route: DECIDED 2026-08-05, un-contain approved

**Blocks:** step P7.

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
route. Apply the change when step P7 actually starts, not before, and treat
the first live run against real data as the real test of the machinery
described above, because it is: nothing has proven it against real data yet.

---

## 9. The cutover: DECIDED 2026-08-05, the five-step path, not the twenty-five

**Blocks:** step D2, going live. This is the largest unscoped item.

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

**Technical.** Cross-ref step D2. None of the objects the twenty-five-step
chain requires exist in code (`ReleaseBundleEnvelope`,
`PostActivationControlHead`, `CandidatePromotionFence`,
`GeneratedLockPlanRegistry` are zero files each), and there is no import,
activation, rollback or restore script today. Build against the five steps
above; fold a smoke test immediately after step 4 rather than treating it as
a separate, optional sixth step.

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

**Technical.** Cross-ref step D3.
`lib/programme-gates/governing-registry.js:267` is the loader that currently
throws unless every pre-production gate stays `OPEN`; it needs amending so a
gate can record a genuine pass. The self-verifying layer to delete is
`lib/programme-gates/p9-acceptance-*`, 1,001 lines across 5 modules.

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

In any case it is not reachable until step D2 is, which in turn is not
reachable until this branch is merged to `main`: 287 commits and 910 files
that have never been tested as a merged unit (see step D1 in `ROADMAP.md`,
which Ben did authorise, on 2026-08-05: "you can update the roadmap on these
points and get things up on main, I don't like living in branch land for
ever").

---

## 13. How Canonical V2 gets served, and when V1 comes off: DECIDED 2026-08-05, the cheap per-family pattern, gated by the equivalence harness

**Blocks:** step P3 and, through it, every family P9 rolls out afterward.

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

**Technical.** Cross-ref `ROADMAP.md` step P3. The rigorous chain
stays in the repository, real and passing, and is not being deleted: eleven
components built against
`docs/superpowers/specs/2026-07-27-metric-scoped-serving-admission-f22-design.md`,
F16 through F26 inclusive. It is not extended to any other family. The cheap
pattern's reference implementation is
`lib/canonical-v2/termination-fee-serving-source.js` and
`components/review/table-configs/termination-fees.config.js`; P9 repeats it
per family. The equivalence harness is `scripts/review-parity-check.js` (see
P1). Where it cannot compare a family, that is an absence of committed V1 input, not a fault in it, and it does not gate retiring V1: Ben ruled on 2026-08-05 that the harness is a convenience and not a gate.

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

- **Representation subjects: stay open indefinitely.** The list does not
  close. It is designed to stay open-ended rather than work toward a fixed,
  closeable set.

- **The document-verification status name:
  `DOCUMENT_TEXT_VERIFIED_AGAINST_SOURCE_BYTES`.** Chosen because it names
  document-level verification specifically, not corpus completeness, so a
  later completeness state can be added without colliding with it. This
  gets built into a permanent versioned record format, so treat it as fixed
  once real records start using it.

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
