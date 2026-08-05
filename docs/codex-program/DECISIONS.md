# Decisions needed from Ben

As at 2026-08-05. Each says what is being asked, why it matters, the options,
and my recommendation. Nothing here is urgent except number 1.

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

## 2. How the browser authenticates

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

**Recommendation: session cookie.** It is the only one of the three that is
still correct if this ever has a second user, and the page code does not
change. The third option is not really authentication and would have to be
redone before any client sees this.

---

## 3. Permission to show V2 in place of V1, family by family

**Blocks:** steps P1 onward. Nothing can move the count without it.

**What is being asked.** Permission to switch the review page from the old
extraction to the new one, one provision family at a time, starting with
termination fees, in preview only.

**What is already built.** The per-family switch, a side-by-side view showing
V1 and V2 together with a verdict on each row, and an equivalence harness
that refuses to report a pass when its coverage is incomplete. All behind a
flag that cannot evaluate true in production.

**Recommendation: yes, and it is low-risk.** Because you asked for V1 to stay
visible beside V2 rather than being replaced, the failure mode is visible
rather than silent: a field V2 has not extracted renders amber as "not yet
extracted" beside V1's value, never as though the agreement were silent.

---

## 4. Willful breach: one row or two?

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

**Recommendation: two rows.** They are different questions a lawyer would ask
separately, and the new claim vocabulary already governs only the sole-remedy
variant, so wiring it to the existing single row would silently narrow what
that row means without changing its label.

---

## 5. Payment deadline: one claim per limb, or one verbatim string?

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

**Recommendation: one verbatim string for now, per-limb later if anyone asks
for it.** The per-limb version is real work and its value is speculative. The
string version loses nothing that exists today, because the legacy field is
already the same prose.

---

## 6. Does "fee required to terminate" belong to Termination Rights?

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

**Recommendation: move it to Termination Rights.** The registry already says
that is where it belongs; the display is what drifted.

---

## 7. Approval to clear duplicate claim rows in production

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

**Recommendation: approve the identification now, hold the deletion.** Knowing
whether 128 cards are affected or zero changes how step P6 is planned, and
counting costs nothing.

---

## 8. Un-contain the market statistics route

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

**Recommendation: approve it when step P7 starts, not before.** And treat the
first live run as the real test, because it is.

---

## 9. Is the full cutover chain proportionate?

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

**Recommendation: the smaller path.** The documented chain was designed for a
scale and an audience this does not have, and building it would be months.
The five things I would not cut are: a backup and restore drill actually
performed, import to an inactive namespace, a comparison proving the imported
data matches, a rollback that has been tested rather than described, and a
smoke test after activation.

---

## 10. Fix the gate registry, or stop scoring it

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

**Recommendation: keep the gates that map to real engineering, delete the
rest.** Backup and restore, render parity, structured claims, security, import
parity and cutover are real work worth tracking. The self-verifying layer,
whose validator compares its own output to itself, catches nothing and should
go. Every defect actually caught in this codebase was caught by ordinary
engineering.

---

## 11. Original or amended terms for market comparison

**Blocks:** nothing before launch.

**The problem.** When a deal's termination fee is renegotiated by amendment,
market statistics have to decide which figure counts: what the parties first
agreed, or what they ended up with. Both are defensible. Mixing them silently
is not.

**Recommendation: the amended terms, labelled.** What the parties ended up
with is what "market" usually means. But the statistic should say which basis
it used rather than leaving the reader to assume.

**Only one deal in the corpus is currently known to have an amendment**, so
this can wait until amendment parsing is built after launch.

---

## 12. Go live

**Blocks:** everything, and it is last.

The explicit, one-time authorisation to switch production to the new system.
Not needed until step D2, and step D2 is not reachable until this branch is
merged to `main`, which is 287 commits and 910 files that have never been
tested as a merged unit.

---

# Smaller questions, blocking nothing

Recorded so they are not lost, none of them urgent.

- **A market-position rank for four provision types** (Made Available,
  Ordinary Course, Material Contracts, General Covenants). No rank has ever
  been approved for any of them, and nothing has been invented in the
  meantime, correctly.
- **Whether four no-shop concepts should become fully approved.** They exist
  in code and are retained but carry no recorded approval, which is part of
  why six items sit on permanent hold rather than being counted either way.
- **Whether the list of representation subjects should ever close**, or stay
  open-ended indefinitely.
- **What to name the "a human has verified this document" status.** Whatever
  is chosen gets built into a permanent versioned record format, so it is
  expensive to change once real records exist. It must describe document-level
  verification specifically, not corpus completeness, or a later completeness
  state cannot be added without colliding with it.

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
