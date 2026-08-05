# Operating rules

What anyone must know before starting work on this programme. Self-contained:
read this document on its own, before reading anything else.

---

## Exact working location and authority boundary

Branch: `codex/m3-production-phase1`. Worktree:
`/Users/bengoodchild/Documents/Claude/precedent-machine-m3-production-phase1`.

**Production authority is NONE.** Since 2026-08-05, building and activating
routes locally and on Vercel preview deployments is permitted. Everything
else stays prohibited regardless of that carve-out:

- production activation of any route;
- accessing or changing production data;
- using real credentials or a real production database client;
- running extraction or a model replay against live sources;
- importing candidate data;
- executing the v1 reclassification apply (only "go, fixtures first" is
  authorised; the execution act itself is not);
- issuing a freeze, policy-adoption, successor-M1 PASS, M3 PASS,
  deployment, or production receipt.

A fresh session must not infer more authority than this from anything
below, or from anywhere else.

---

## Glossary

A few terms recur throughout this programme's documents and are worth
defining once.

**The corpus.** The set of merger agreements the product has ingested and
analysed.

**A provision.** A clause or term in an agreement: the termination fee, the
MAE definition, the no-shop.

**Extraction.** Reading an agreement and pulling structured facts out of it:
not just "here is the fee clause" but "the fee is 3.5% of equity value,
payable on a superior proposal".

**The old system and the new system.** The product currently runs on an
older extraction pipeline. A second, more rigorous one has been built
alongside it. Almost all of the roadmap is about proving the new one is
trustworthy and then switching to it, without a gap where the product is
wrong.

**Preview.** A version of the site running on a test deployment, not the
live one. Real code, real pages, safe to look at. Nothing a client would
ever reach.

**Live or production.** The real site, with the real data.

**Served.** Data is "served" when a real page actually displays it to a
user. Data can exist, be correct, and still not be served, because nothing
reads it yet. Most of the roadmap's remaining work is about that gap.

---

## Owner's rulings

Every ruling below is dated and load-bearing. Nothing here grants
production authority; these are decisions about direction, design and
process within the boundary above, that production stays prohibited.

### Displaying the finished analysis moves earlier, and amendments split either side of launch (2026-08-05)

Ben corrected the sequencing of an earlier draft of the plan, which had put
all display work at the end, after the search and market tools, and had
treated amendment handling as a single undifferentiated, fully-deferred
item. Two corrections followed, both now reflected in the roadmap's
display-switchover step and its amendment-detection step:

- Displaying the 73 provisions whose analysis is already finished moves to
  immediately after improving the comparison view, because only 1 of the
  104 outstanding items actually depends on the search tools being switched
  on first; the other 103 do not, and the review page is where users would
  actually see the difference.
- Amendment handling splits either side of launch: detecting an amendment
  and showing a visible warning ships before launch, because going live
  with no detection at all would let an amended deal silently display
  superseded terms; working out exactly what changed and showing it in the
  review tab is genuine post-launch work, deferred alongside export.

### Pre-production activation phase opened (2026-08-05)

Ben opened a new phase that supersedes the earlier "no route activation"
boundary **for preview only**. Permitted: build and activate routes locally
and on a Vercel preview deployment. Still prohibited: production
activation, production data, and any change to production data. Ben's own
framing: "Do not treat 'not authorised for production' as 'stop
engineering'." Continue through preview activation, shadow mode, testing,
adversarial review, source-admission work and migration rehearsal; stop
only when the sole remaining act is the final production cutover or
go-public decision.

### Standing instruction on authority boundaries (2026-08-05)

Recorded verbatim from Ben, and governing every lane since:

> An authority boundary blocks only the prohibited act, not the wider
> queue. Record the boundary, continue every safe preparatory,
> integration, testing, audit and documentation task, and batch any
> required rulings for me. Stop only when no meaningful safe work remains.
> Keep the handoff and next-task queue current throughout, and never
> change a status merely to make a metric pass.

### Adapter proof: every named adapter needs its own consumer (2026-08-05)

> If a surface names multiple required adapters, consuming only one is
> insufficient. Each required adapter must have exact consumer proof. Fail
> closed unless the register expressly marks the adapters as
> alternatives.

Means: a surface citing several required modules cannot be marked served by
proving just one of them. The only opt-out is an explicit
`adapter_set: 'ALTERNATIVES'` marking, which no current row uses, so the
default is fail closed. This closed a real latent risk: one affected
surface names four separate adapters.

### Locator proof: the exact path and the exact executed export (2026-08-05)

> Consumer proof must resolve the complete import specifier to the exact
> repository path and exported function or adapter that is executed.
> Basename-only matching is not acceptable. Ambiguous imports, dynamic
> imports, unresolved re-exports and test-only paths must fail closed.

Means: proof that "something imports this file" is not enough. It must be
the exact file (not a same-named file elsewhere), a real exported symbol,
referenced beyond its own import line, with dynamic imports, test-only
consumers and unreadable export shapes all rejected outright.

### One preview lane for all four areas (2026-08-05)

One consistent Review preview lane for all four areas, labelled
`Canonical V2 Preview`, read-only, default-collapsed, with the existing
legacy output unchanged beside it. This replaced four previously
inconsistent, bespoke per-area implementations (one family showed dark
previews inline; another excluded them outright).

### The gate may widen to Vercel preview, never production (2026-08-05)

The gate that switches on the dark preview machinery may widen from
local-only to also cover a genuine Vercel preview deployment, but only
after full acceptance passes, and it must stay server-side and
environment-bound. No query parameter, browser state or client flag may
bypass it. Production stays hard off on two independent signals at once.

### Activation order (2026-08-05)

Review preview for all four areas together, then the trusted
source-admission boundary, then Compare, then Query, then Market, then a
production activation package for Ben's later approval.

### termination-fee-query-derived-values stays unserved until Query actually serves (2026-08-05)

This one row stays at "integrated but not served" until the roadmap's
search-activation step is genuinely active in preview. It is not to be
reclassified early merely because a consumer technically imports the
underlying module.

### Strict locator rule: transitive call-graph proof (2026-08-05)

Build transitive import and call analysis so a genuinely served row can
prove the complete path from a served route through to the exact
locator, rather than stopping at "some export of this file is imported
somewhere." Fail closed when the path is ambiguous. Do not demote a row
merely because a shallower, direct-import-only analysis would have missed
it: a transitively-served row is still genuinely served.

### Excerpt identity is never a unique card identity (2026-08-05)

> `excerpt_id` is not a unique card identity, programme-wide. Card identity
> must bind the deal, the provision or component, the exact source span,
> the occurrence and the source revision. Audit every existing and future
> bridge for excerpt-only identity.

This is the ruling behind the migration-ordering work described in the
roadmap (the production-data-migration step and its known risks), and
behind the fix, recorded in Work completed, that made previewing all four
areas together possible at all (two cards can legitimately quote the same
sentence and must not be treated as colliding).

### ADR-001 accepted: flattening is scaffolding (2026-08-05)

Ben accepted ADR-001 in full. It is reproduced in full below rather than
summarised here, because it is an architectural decision the plan depends
on throughout, not a one-line ruling.

### Source trust is a human review state, not a cryptographic one (2026-08-05)

Ben ruled against a corpus-level trusted controller and key registry as the
route to proving a deal's document set is complete and authentic. His
design instead: track source status as "not human verified" by default,
because a document set is legitimately open and can always grow; provide a
control for a human to verify it; and let a human instruct an AI to look
for further documents, rather than requiring a signed authority to assert
completeness. This converts an authority-proof problem needing key custody
and signature verification that do not exist into a review-state problem
this codebase already models well elsewhere, and it matches the real-world
fact pattern: completeness is a judgement someone makes and can revise, not
a fact that can be proven cryptographically. Consequence: document-level
verification and corpus-level completeness are two independent axes, never
one scale, so that corpus completeness can later become its own
independent human-owned state without redefining what document verification
means.

### Source completeness is an advisory admin workflow, not a gate (2026-08-05)

> There should be an admin page where someone verifies the docs are
> complete. If they don't think they are, they can interact with an AI
> and say: go and find it.

And, sharpening the same day:

> You deem the filing verified but there is a health warning somewhere
> that a human hasn't confirmed there are no other docs etc. That lets us
> ingest and get moving. Then the human should have a page it can interact
> with an AI to figure out what the right docs are.

The load-bearing part: document verification stands alone and is never held
hostage to corpus completeness; the corpus-completeness state is advisory
only, a health warning shown wherever the data is used, and must never
fence data out, block ingestion, or gate a route. The point is to keep
moving, with the open question surfaced honestly rather than blocking on
it.

### The comparison and search product shape (2026-08-05)

Approved shape: provision cross-cut (one provision, every deal), what's
market (distribution of a value across the corpus), screen and filter
(deals matching criteria), deal comparison (the review page with extra
columns, already built and already correct), and a natural-language router
across the above. Approved for retirement: the `DEAL_COMPARE` and
`DEAL_TO_MARKET` search kinds and the old standalone comparison page (all
three are covered by the roadmap's comparison-page retirement step). The
reasoning given was not only redundancy: two independent implementations of
one question is exactly what produced this programme's feature-flag
inconsistency and a live rendering bug (see Work completed), and divergence
between duplicated implementations is a recurring failure mode in this
codebase specifically.

### Comparison view requirements (2026-08-05)

Four decisions, folded into the roadmap's comparison-view-improvement step:
the old page's summary matrix is not wanted, which clears the last
objection to retiring it; users must be able to select which terms appear
in a comparison, at both section and row level; the compared-deal cap must
be removed, with on-screen scrolling and a genuine export capability as the
two separate answers to "how many deals"; and the market sidebar must show
both the current comparison set and the whole corpus, side by side, when a
comparison is open.

### The table-driven locator verifier is deferred (2026-08-05)

Nineteen rows cannot be proven served by the current locator rule because
their field is reached through a computed table lookup rather than a
per-field branch (full technical detail is in the roadmap's known risks).
Ben agreed to defer building a new verification instrument for this class
of claim, and corrected the premise it rested on: the three-field limit
these rows are pinned to belongs to a compact cross-deal comparison grid,
not to the review page or a full document view. Ben's actual intent for the
comparison product is a full side-by-side agreement view, which the
roadmap's comparison-page retirement step is already moving toward. If that
supersedes the grid, most of these rows need re-registering against the new
surface rather than being made provable against the old one, which may
dissolve the question rather than requiring it to be answered. Do not build
a new verifier until the target surface is settled.

### Amendment handling: the shape, and what ships before launch (2026-08-05)

Covered in full under the roadmap's amendment-detection step. Ben's
original instruction on the full design was to think it through, add it to
the plan, and not build it yet; that full design (the "parsing" half)
remains deferred to after launch. Ben has since carved out a smaller,
pre-launch scope from within it: detecting that an amendment exists and
showing a visible warning, which does need to ship before go-live.

### Two decisions delegated to engineering (2026-08-05)

Ben was asked to rule on two items and deferred both back to the
engineering lane, which resolved them and recorded the reasoning:

- **Leave the excerpt unique-index alone for now.** It is production
  schema (outside current authority to change regardless) and it is
  currently load-bearing, the only thing preventing the live corruption
  path described in the roadmap's known risks. It moves into the rehearsed
  migration in the roadmap's production-data-migration step once the
  write-side fix lands, not before.
- **The preview route uses fixtures, not live staging data.** Ben's own
  activation order (above) put the trusted source-admission boundary after
  the shared preview lane; wiring real staging data into the preview ahead
  of that boundary would execute that later step's substance early.
  Fixtures prove the rendering and merge path end to end and leave source
  authenticity to the step built for it.

### Earlier standing ruling: v1 reclassification apply

A separate, smaller thread, not part of the roadmap's twelve steps: whether
to run a reclassification pass over the older, first-generation data. Ben's
ruling was "go, fixtures first". The execution act itself has not been
issued, and the current scaffold for it is not code-ready (see the
roadmap's current state). This does not block or feed into any of the
twelve steps; it is recorded here only so the standing authorisation is not
lost.

---

## ADR-001: dark-bridge flattening is scaffolding, not a serving path

Status: accepted, 2026-08-05, decided by Ben. Scope: Canonical V2's four
dark bridges and anything that flattens the new system's output into the
old, legacy card shape. This record decides an architectural constraint
only. It grants no serving, persistence, activation or production
authority.

**Context.** The new system's core model is normalised: excerpts, provision
instances, claim revisions, provision components and relationship revisions
each carry their own identity at the right granularity. The legacy card
shape is denormalised: one row per card, with claims hanging off it, bound
by an excerpt reference. It is a database contract plus a read path, not a
rendering concern; the review table is downstream of it.

The four dark bridges flatten the first shape into the second. That was
deliberate: it let the new system's output be inspected beside the old
output without rewriting the review renderer, and identical shapes are what
make a side-by-side equivalence check possible at all. Flattening does two
separable jobs. One is shape conversion. The other is verification: quote
grounding, lineage binding, identity reservation, open-item reconciliation.
The verification is valuable whatever shape the output lands in. The shape
conversion is where information is destroyed.

**The problem this record exists to prevent.** Every defect found in the
adversarial audit that preceded this decision was a consequence of the
flattening, not of the new system itself, which was clean throughout.
Specifically: excerpt-only card identity in three of the four bridges; a
cross-family merge collision that made it impossible to chain two bridges
into one review deal; and a bare database uniqueness rule that would
hard-block any future attempt to promote flattened data. The root cause is
that the same field name, `excerpt_id`, carries incompatible meanings on
each side. In the old shape it embeds the deal, section and a span hash, so
it is one-to-one with a card by construction. In the new shape it is a pure
content hash of the quote and its position, with no deal or provision
component, so two siblings quoting one sentence correctly share it.
Translation copied the field name across and silently inherited the old
uniqueness assumption with it. Scaffolding that works tends to become
permanent; today the only thing stopping flattened cards from being
persisted is that bare uniqueness rule, which is an accident of history
rather than a decision. This record replaces the accident with a decision.

**The decision, in full.**

1. Flattening into the legacy card shape is a preview and equivalence
   scaffold. It is never a serving path and never a persistence path.
2. Flattened cards must not be written to the production card table, the
   claims table, or any other persistent store, ever. No promotion path,
   no import, no backfill, no migration. If a future requirement seems to
   need it, that is a signal to build native serving instead, not to relax
   this.
3. Native serving must consume the new system's projections directly, not
   bridged legacy cards. This is what actually clears a blocker, and it
   inherits none of the flattening's identity problems.
4. Do not extend flattening beyond the four existing areas (Material
   Contracts, No Other Reps/Fraud, General Covenants, Representations). A
   fifth bridge needs a new decision, not an extension of this one.
5. Bridge verification logic is worth keeping and may be reused by a
   native path. It is the shape conversion that is scaffolding, not the
   guards.

**Why this is already structurally enforced, and where it is not.** The
parity register enforces most of this mechanically. A dark bridge is
unreachable from any served route, so a surface proved only by a bridge can
never report as genuinely visible and can never clear a blocker; it is
structurally incapable of becoming the serving path. What is **not**
enforced mechanically is constraint 2: nothing in code stops someone
writing flattened cards into the production table except a database index
that exists for unrelated reasons, and that the excerpt-identity
remediation (the roadmap's production-data-migration step) may legitimately
want to change. Anyone proposing to alter that index must satisfy
constraint 2 by some other explicit means first.

**Removal condition.** This scaffolding is not permanent, and the removal
condition is testable rather than a matter of judgement: a bridge is
removed once every parity surface for its area reports genuinely visible
through a served consumer that imports the new projection directly, under
the strict locator rule. At that point, delete the bridge module, its
config integration, its fixtures and its tests. Do not leave it dormant
behind a disabled gate; a disabled scaffold is still a maintenance
liability and still a promotion temptation. Until then, each bridge stays
dark, gated, read-only, and outside every product route.

**Consequences.**

- The review preview lane (see the preview-lane ruling, above) depends on
  bridged cards, so it is scaffold-shaped too, and inherits this same
  removal condition. It must not be mistaken for the eventual native review
  surface.
- Work that clears blockers and work that improves the preview are
  different activities. Improving the preview never moves the blocker
  count.
- The seven-route search containment must not be quietly narrowed to make
  a blocker count improve; any change to which routes count as contained
  is a decision in its own right.
- The excerpt-identity remediation (the roadmap's production-data-migration
  step) is required regardless of this decision, because the live read
  paths it touches are real product code, not scaffolding, and their
  keying is genuinely wrong today.

---

## Working conventions

These govern how work is done on this programme, independent of which step
is in progress. They are standing methodology, not one-off decisions like
the rulings above.

**A receipt must name its exact command.** A bare pass or fail count is a
claim, not evidence. A result counts as a receipt only when it is recorded
together with the exact command that produced it. (Work completed records
the finding that established this: of eight historical test-count claims
checked for reproducibility, only the two originally recorded with their
exact command reproduced exactly.)

**Security and authorisation properties are proven by direct behavioural
probe, not by inspection.** A property such as "this entry point is gated"
is verified by calling the real entry point with the gate switched off and
confirming it refuses, never by reading the code or by trusting that an
existing test suite is green. Green suites had only ever exercised the
gate-on path; the defect this convention exists to prevent was found by
probing the gate-off path directly. (Work completed records the finding.)

**The gate is asserted before any other validation, at every public entry
point.** An authorisation or gate check runs first, ahead of input
validation or any other logic. Checking input before checking authority
lets a hand-built request that bypasses the normal builder skip the gate
entirely. This exact defect was found independently in two separate
implementations, which is what turned the fix into a standing rule rather
than a one-off patch. (Work completed records the finding.)

**No status may be changed merely to make a metric pass.** Ben's own
instruction, standing since the authority-boundary ruling above: a status
changes only when the underlying thing it describes is actually true,
never to make a count read better.

---

## Ben's legal and taxonomy rulings

Restored 2026-08-05. These were dropped during the document consolidation on the
grounds that they were implementation history. That was a misclassification.
They are standing constraints on what any implementation is permitted to do, so
they belong here and nowhere else.

Some are additionally enforced in code, which is stronger than prose. The
approved family materiality ranks, for example, are pinned mechanically by
`tests/canonical-v2-approved-family-materiality-ranks.test.js`: No-Shop 50,
Antitrust 63, Interim Operating Covenants 65, Dividends 84, D&O 85, Merger
Structure 87, Appraisal 88. Where a ruling below is enforced by a test, the test
governs; where it is not, this list is the only record and must be honoured.

Made Available, Ordinary Course, Material Contracts and General Covenants remain
at rank 99 because no exact rank was ever approved. Do not invent one.


- Start v1 reclassification apply: go, fixtures first.
- Termination-right Mutual and Legal concepts: adopt both.
- Mutual-right party capacity: adopt.
- No-Shop fiduciary review rank: 50.
- No-Shop day default: calendar.
- Capital Structure rank: 52.
- Financing-source candidate: exact open world.
- Tax-opinion cooperation: promote as covenant.
- Rank collision: Merger Structure 87, Appraisal 88.
- Guaranty core concepts: adopt both.
- Meeting dual claims: approve only the compatible pair.
- Whole-letter carve-outs: open world.
- Closing Conditions core taxonomy: adopt four.
- IOC core taxonomy: adopt ten.
- Antitrust 63, IOC 65.
- Record date and broker search: separate presence facts.
- Parent approval and Merger Sub approval: separate concepts.
- Meeting adjournment reasons: no quorum, insufficient votes,
  supplemental disclosure, legal requirement.
- Appraisal owns standalone sections. Consideration owns availability and
  conversion/exchange sections.
- Consideration: per-share value, exchange ratio, appraisal availability;
  track CVR presence only; structured election mechanism approved.
- Appraisal availability by necessary implication requires an appraisal
  statute reference, for example DGCL 262.
- Dividends: coordination and special dividend concepts; recurring mandated
  dividends remain open.
- Dividends 84, D&O 85.
- IOC long tail stays exact open evidence for M3 pending commonality.
- IOC exceptions attach to the narrowest limb; parent only when all limbs.
- IOC numeric shape is value, unit, basis and period, with no unsupported
  arithmetic in the raw claim.
- Derived comparisons may use signing-date FX and explicit period conversion
  in a separate, clearly labelled processing record. Never change raw data.
- CVR: presence only; build the CVR agreement later.
- Outside-date extension: structured object, no inferred total.
- Legal-restraint finality states remain distinct in storage.
- Closing Condition and Termination Right standards remain distinct; retain
  an explicit quoted cross-reference only when present.
- Sole remedy: Remedies owns effect and separate Fraud/Willful Breach
  exceptions; Termination Fee keeps context and link.
- Fee tail: period, arming event, qualifying transaction, threshold and
  same-proposal requirement.
- Late interest: presence, quoted benchmark/base and due-date reference; no
  derived rate or day count.
- First comparable definitions: Acquisition Proposal, Superior Proposal,
  Intervening Event, Knowledge and Willful Breach.
- Later definition slices: Tax, Tax Return, Made Available and Ordinary
  Course. Company Employee routes to Employee; Material Contract routes to
  Material Contracts.
- Neutral long-tail definitions retain term, exact text, cross-reference and
  likely owner. Same terms, for example Law, may be compared across deals,
  but `DEF-GENERAL` is not one market concept.
- Misclassified definitions require content-reviewed reclassification, never
  subtype-only mapping.
- `definition_components` remains unused and non-authoritative through M3.
- `REM-CAP` is not a standalone Remedies concept. Preserve cap and
  sole-remedy evidence through the linked owners.
- Closing-condition revisit pin is narrow: only representation-accuracy
  standards are manually blocked.
- TopBuild MAE uses per-limb plus trailing-list disproportionality and union
  output.


---

## The document set, and which document owns what

Nine planning documents exist. Only four are live. Read this before editing any
of them.

**The four live documents.**

| Document | Owns | Editable |
| --- | --- | --- |
| `docs/codex-program/OPERATING-RULES.md` | This file. Authority, rulings, architectural decisions, conventions | Freely |
| `docs/codex-program/ROADMAP.md` | The sequence to publication, decisions needed, open risks, current state | Freely |
| `docs/codex-program/WORK-COMPLETED.md` | History. Append-only | Freely |
| `docs/codex-program/adversarial-tests.md` | The register of adversarial testing and what it found | **Governed, see below** |

**Five stubs.** `MASTER-PLAN.md`, `ROADMAP-TO-PUBLICATION.md`,
`CANONICAL-V2-ACTIVATION-PACKAGE.md`, `ADR-001-dark-bridge-flattening-is-scaffolding.md`
and `docs/handoffs/CODEX-TO-CLAUDE-HANDOFF-2026-08-04.md` are superseded pointers.
They are kept only because commit messages and other sessions reference them by
path. Do not add content to them. The handoff stub additionally carries the
authority boundary at its top, so a session that reads only that file cannot
infer more authority than it has.

**Full historical detail** beyond what `WORK-COMPLETED.md` condenses is in commit
`59568f92`, which holds the original 3,629-line handoff. Recover it with
`git show 59568f92:docs/handoffs/CODEX-TO-CLAUDE-HANDOFF-2026-08-04.md`.

## Governed documents and the specification manifest

Six documents are declared members of
`docs/codex-program/specification-manifest.json`, which pins each one's exact
byte length and SHA-256:

- `docs/CODEX-PROGRAM.md`
- `docs/codex-program/EXECUTION-LEDGER.md`
- `docs/codex-program/programme-gates.yaml`
- `docs/codex-program/m3-family-parity-register.json`
- `docs/codex-program/canonical-contracts.md`
- `docs/codex-program/adversarial-tests.md`

**Editing any of them breaks verification until the manifest is regenerated.**
The failure is not obvious: `node scripts/verify-codex-program-spec.mjs` throws
"Specification drift manifest is stale", and the specification test suite fails,
with nothing pointing at the file you actually changed.

After a deliberate edit to a governed member, regenerate once and verify:

```text
node scripts/verify-codex-program-spec.mjs --write
node scripts/verify-codex-program-spec.mjs
node --test tests/codex-program-specification.test.js
```

Regenerate only after the governed documents have stopped changing. Regenerating
while another lane is still editing produces a manifest that is stale on arrival.

## Verifying where things stand

None of these change anything. Run them before believing a claim about state,
including a claim in these documents.

**The outstanding count.** The single number that measures distance from
release. It must be 104 unless real work moved it.

```text
node --input-type=module -e "
const m = await import('./lib/canonical-v2/native-producer/m3-family-parity-register.js');
const R = m.CURRENT_M3_FAMILY_PARITY_REGISTER;
const b = m.listM3ProductParityBlockers(R);
const v = {}; for (const x of b) v[x.live_product_visibility] = (v[x.live_product_visibility] || 0) + 1;
console.log('blockers=' + b.length, JSON.stringify(v));
"
```

**Full acceptance.** The invariants script runs the whole test suite first, so it
is the single command that proves the tree is sound. Then build.

```text
bash scripts/ci/run-all-invariants.sh
npm run build
```

**The second generated artefact.** The product-field baseline pins the exact
hash of each of its source files in two places, the script and its test, so it
can never silently track whatever the sources happen to be. When a source
legitimately changes, both pins move together, deliberately, with the reason
recorded inline.

```text
node scripts/process-intelligence-baseline.mjs
node scripts/process-intelligence-baseline.mjs --check
node --test tests/process-intelligence-baseline.test.js
```

**Before deleting any file**, search for tests that read it by path, not only for
imports. A test using `readFileSync` on a deleted file is invisible to an import
search and will fail acceptance after the deletion looks clean.

---

## Required reading: the governing programme document

**Correction, 2026-08-05.** This file previously claimed to be self-contained.
It is not, and treating it as such would cause real harm. `docs/CODEX-PROGRAM.md`
carries non-negotiable governance that appears nowhere else, and it must be read
alongside this file. The essentials are restated below so nobody misses them,
but the governing document remains the authority.

### Decision rights, and the worst failure class

Codex agents DRAFT. **Fable, or an independent high-reasoning reviewer, REVIEWS
every diff that touches legal semantics, identity, or extraction behaviour.**
Ben DECIDES taxonomy values, codebook vocabularies and freeze-gate changes.

The governing document states the reason plainly, and it is the single most
important sentence in this programme:

> A plausible-but-wrong legal answer is the worst failure class, worse than no
> output. Nothing merges unreviewed.

That is why adversarial review is not optional polish. A confidently wrong
extraction reads exactly like a correct one.

### Mechanical gates on every change

The full required set, wider than the acceptance commands listed earlier in this
file:

- `npm test`
- `npm run build`
- INVARIANT lint, post-commit
- **golden evals** (`node scripts/eval.js`) for anything touching extraction
- **drift tests** for anything touching registries
- **quote verification at zero flags** and **ingest-QA gates** for ingestion
  changes

The acceptance runbook above covers the first three. The last three are
change-specific and must not be skipped because the general runbook passed.

### The four milestones, and what Ben actually approves

Four review milestones remain: contract freeze, vertical slice, full-corpus
certification, and pre-cutover. Each receives **one three-lane adversarial
review** by a high-reasoning reviewer, across architecture, legal and query
lanes, each lane given the diff since the last reviewed state, the relevant
contracts, and **no prior conclusions**. The result is one plain Markdown
acknowledgement under `docs/acks/` recording the commit range, date, reviewer,
findings, dispositions and PASS or FAIL.

A failed review produces one bounded fix list, and only the fix diff is
re-reviewed. A normal legal-semantic diff review is a merge requirement, not a
milestone.

Ben's approval is required for exactly four things, and nothing else:

1. the material contract bundle freeze;
2. material taxonomy or codebook changes;
3. production import, where the governing import contract requires it;
4. the one-use production cutover authorisation.

The M1 Markdown acknowledgement is the only pre-production approval artefact. No
signed status, signer record or publication record carries pre-production
authority.

### Security tiers

Tier A is active now: accidental production writes, credential separation,
preview protection, secret handling, and the live-route guard tests. Tier B, the
full attacker-model certification work, is deferred to Phase 12.

Two Tier A rules bear directly on the preview activation work:

- **No production credential may enter a Preview**, and no service credential
  may enter browser-visible code.
- **Corpus extraction, replay, backfill and load testing never run against
  production.** Corpus writes are Ben-run, local, and dry-run first.

### Branch and merge discipline

Work proceeds on bounded `wp/*` branches, and every merge leaves `main`
deployable. Routine branch work, integration, deployment and ledger updates do
not require Ben.

---

## Two constraints recovered from the original record, 2026-08-05

Both were dropped during consolidation and found by a completeness audit. They
are standing constraints, not history.

### Legacy rendering must not be retired before the native path proves equivalent

The original record states it plainly, and it appeared twice:

> Do not retire legacy rendering before the native path proves equivalent.

This is a separate constraint from ADR-001, which governs the scaffold data.
This one governs the **legacy card-rendering path itself**. When a family is
switched over to the new analysis, the old display path stays alive and working
until equivalence is proven for that family. Switching one off because native
code exists is not the same as proving it produces the same answer.

The failure it prevents: a family is migrated, the old path is deleted as
tidy-up, a display regression reaches users, and there is nothing to fall back
to.

### A gate is not a precondition

> Toggling the dark-bridge gate's environment variable in any environment,
> including the now-permitted Vercel preview, must never be treated as
> substituting for the real preconditions. The gate stops dark integration
> leaking into production. It says nothing about whether a surface is genuinely
> served.

Seeing the preview lane render cleanly on a preview deployment proves the
rendering works. It proves nothing about serving. The two real preconditions are
unchanged: the evidence record reaches a terminal disposition, and a consumer
that a live non-contained route actually reaches imports the exact projection,
satisfying the adapter-proof and locator-proof rulings above.

This distinction is easy to lose precisely because a working preview looks like
success.
