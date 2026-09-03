# Precedent Machine

Next.js M&A contract-review app: parses merger agreements from SEC filings,
classifies provisions, extracts structured facts, renders a review UI, and
searches precedents across deals. Supabase Postgres backend, deployed on
Vercel, production tracks `main`.

Before pushing, run the test files for the seam you touched
(`CI=true node --test <files>`), and `npm run build` only if `lib/`, `pages/`
or `components/` changed. CI runs the full suite on every push; do not run it
locally against unchanged code. (Ben, 2026-09-03, CI audit: this replaces
the earlier rule to run the whole suite before every push.) A seam includes
every test that pins the bytes of a file you changed: `grep -rl <basename>
tests/` before deciding what to run.

Three checks are named CI gates, not part of `npm test`: `gate:baseline`,
`gate:near-miss` and `gate:replay-baseline`. The last two each re-derive a
committed evidence report from every admitted corpus run and take about
twenty minutes; they run in CI as the `evidence-gates` job once per exact
input digest (`scripts/ci/expensive-check-checkpoint.mjs`) and are skipped on
an exact checkpoint hit. Regenerate with the script's `--write` mode and
commit the diff.

A new test asserts behaviour or output bytes, never a script's source text,
import list, error order or argv literal. The phase-1 authority-boundary
scanner and the sealed-receipt bindings are the standing exceptions; do not
add a third.

## Read these before doing anything

`docs/core/` holds the working set. Six documents, and they are the only
programme documents that are current.

1. **`docs/core/OPERATING-RULES.md`** — what you may and may not do, and the
   standing conventions. Read the authority boundary at the top in full.
2. **`docs/core/PLAN.md`** — the step-by-step plan to production, numbered
   Step 1A, 1B, 2A. Each step names the files to change and the command that
   proves it done.
3. **`docs/core/COMPLETED.md`** — steps already done, each with the evidence
   that closed it. A step moves here from the plan when its proof passes.
4. **`docs/core/DECISIONS.md`** — decisions already taken, with reasoning.
   Read before proposing anything that sounds like a fresh design choice.
5. **`docs/core/CODEBASE-GUIDE.md`** — how the system works end to end, with
   the file paths, function names and commands to act on it.
6. **`docs/core/GRAVEYARD.md`** — what was built and is no longer used, and
   whether to keep, delete or revive it.

`docs/core/README.md` is the entry point. Working notes, one per piece of
work, are under `docs/codex-program/notes/`. Anything in `archive/` is
historical and none of it is current.

## The failure mode that costs the most time here

**This project repeatedly forgets what it has already built, then rebuilds it
or declares it impossible.**

Recent examples, all wrong, all stated confidently: that no general
extraction runner existed, when one runs any of 25 registered families; that
nothing wrote extraction output to the database, when 8,686 lines of schema
and a writer were committed; that automatic section classification did not
exist and 25 families would need mapping by hand across 40 agreements, when a
classifier covering 26 families was built, wired and simply bypassed.

The last one came from a header comment reading "this is the ONLY stage-1
rule this slice ports". True when written, false for months, believed anyway.

So, before saying a thing does not exist:

- **Read the code, not the comment.** A header claiming "this module only
  does X" is a claim to test, never a fact to record. Count the cases.
- **Distinguish a genuine read from a mention.** A path appearing in a file
  is usually a comment. A path passed to a file read is a dependency. This
  has been confused repeatedly, in both directions.
- **Check the library before the scripts.** Per-family work lives in `lib/`.
  Reading only `scripts/` gives the false impression it does not exist.
- **Search before concluding.** `grep -rn "name" lib/ scripts/ pages/ tests/`
  costs seconds. "Nothing calls this" is a strong claim.

When you change what a module does, update its header comment in the same
change. A stale header is the most authoritative-looking lie in a codebase.

## Traps specific to this repository

- **Never pipe `npm test` into `tail` or `head`.** A pipeline returns the
  last command's exit code, so it reports success on a failing suite. This
  has produced false "the suite passes" reports more than once. Redirect to a
  file, echo `$?`, then grep the file.
- **Use `CI=true`.** At least one subsystem behaves differently under CI, and
  suites have passed locally while failing there.
- **Byte offsets, not string indices.** The pipeline slices text by UTF-8
  bytes everywhere. `indexOf` and `slice` count UTF-16 code units. Comparing
  one to the other has produced three separate confident false findings, each
  looking like a real defect. A conversion helper exists; use it.
- **A family returning zero can be correct.** Guaranty finds nothing on an
  unfinanced deal because the agreement has no such provisions. Treating that
  as a bug means inventing provisions the deal does not contain.
- **`review-parity-check.js` exit 2 means nothing could be compared.** It is
  not a pass. A run that proves nothing must not read like a run that proves
  everything.

## Model routing

Routing is the main agent's call. There is no fixed table.

- **Sonnet subagents** for anything with a writable spec: implementation,
  refactors, tests, sweeps, investigation, multi-file searches. If you can
  write the acceptance criteria, delegate it.
- **Opus** for the main loop, for specs, and for work where a wrong call
  corrupts the product: taxonomy and rubric semantics, extraction prompt
  design, canonical provision design.
- **Fable** for adversarial review before anything reaches Ben. Keep these
  short and focused. Never downgrade the auditor to save tokens: it is the
  backstop that makes delegating everything else safe.
- **Codex (gpt-5.x)** is reachable only through the Codex CLI in a local
  terminal, and gets no conversation history, so every prompt must be
  self-contained and must never include secrets.

### Routing by role, not by vendor

The four roles above are what matter; the model names are one vendor's
answer to them. Stated as roles so another vendor can be substituted without
re-reading the routing:

| role | what it is for | Anthropic | OpenAI | xAI |
|---|---|---|---|---|
| **Worker** | anything with a writable spec — implementation, refactors, tests, sweeps, multi-file searches | Sonnet | GPT-5.x via Codex CLI | Grok Code Fast; **Compose 2.5** for easy tasks |
| **Lead** | the main loop, specs, and work where a wrong call corrupts the product: taxonomy and rubric semantics, extraction prompt design, canonical provision design | Opus | **GPT-5.6 Sol** | **Grok 4.5** |
| **Auditor** | adversarial review before anything reaches Ben | Fable | **GPT-5.6 Sol, high effort**, *different session from the drafter* | **Grok 4.5, high effort**, *different session* |
| **Independent check** | a second opinion that shares no context with the first | any of the above from another vendor | | |

**Reach down the worker tier, not up.** A task with acceptance criteria you
could write out does not need the strongest model available; it needs one that
can hold the spec. Use the cheapest model that can — Compose 2.5 on xAI for
easy work, and the equivalent elsewhere. The saving is not the point on its
own: a worker that fails a writable spec is caught by review, so the cost of
choosing too small is a re-run, while the cost of habitually choosing too large
is paid on every task. Escalate on the two-strike rule, not in advance.

**Outside Anthropic, lead and auditor are the same model at different effort.**
GPT-5.6 Sol and Grok 4.5 each serve both roles, with the auditor run at high
effort. That makes the session boundary the *only* thing separating drafter
from reviewer, so it must be enforced deliberately: a new session, no shared
context, and the reviewer must not have written what it reviews. On Anthropic
the model differs as well, which hides how much of the independence was always
coming from the separation rather than from the model.

**The auditor rule is about independence, not about which model.** What makes
the review worth having is that it did not write the thing it is reviewing and
does not share its context. A same-vendor auditor in a fresh session satisfies
that; the same session with a stronger model does not. Never downgrade the
auditor to save tokens — it is the backstop that makes delegating everything
else safe.

**Cross-vendor is worth using where a claim is contested.** Two models from
one family share training and tend to share blind spots. When a finding is
load-bearing and a single reviewer confirmed it, a check from a different
vendor is cheap insurance.

**The identifiers came from Ben, 2026-08-09.** Model line-ups move faster than
this document does, so confirm before relying on a name that has sat here a
while.

The token conservation window that used to constrain this expired on
8 July 2026. Cost is no longer the binding constraint; judgement is.

## What makes delegation safe

1. **Spec first.** Acceptance criteria written before the handoff: files,
   constraints, deliverable, what done looks like. Work you cannot spec is
   work you should not delegate.
2. **Brief hygiene.** Check file sizes before telling an agent to read
   something; a multi-megabyte file at the top of a brief kills the agent
   before it produces a line. Tell agents to write output incrementally, so
   partial work survives.
3. **Verify by artefact, not notification.** Does the file exist, did it
   grow, did the branch move. Agents have been declared dead while working,
   and killed minutes before delivering.
4. **Diff review** against the criteria, looking hardest at what the diff
   does *not* do. Silent scope-narrowing is the common failure.
5. **Mechanical gates:** `CI=true npm test`, `npm run build`,
   `bash scripts/lint/forbidden-patterns.sh`.
6. **Live verification** for anything user-facing. A green build is not a
   working page.
7. **Two-strike escalation.** If delegated output fails review twice, stop
   iterating cheap and redo it on a stronger model. Standing permission to
   escalate without asking.

Never commit unreviewed delegate output.
