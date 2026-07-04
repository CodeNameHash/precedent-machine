# Precedent Machine

Next.js M&A contract-review app: parses merger agreements (SEC filings),
classifies provisions, extracts structured features via Claude, renders a
review UI, and searches precedents across deals. Supabase Postgres backend;
deployed on Vercel (production tracks `main`). Run `npm test` (node:test) and
`npm run build` before pushing — CI enforces both.

## Model routing: your discretion, your watchdog duty

**Routing is the main agent's call.** No fixed table to obey — you decide
which model does what, and you own the outcome. Two non-negotiables frame
every decision:

1. **Token conservation window (until Wed 8 Jul 2026).** Ben is light on
   Claude high-token usage until then. Fable/Opus tokens are the scarce
   resource: spend them on deciding, reviewing, and legal judgment — not on
   producing. Default all production work to Codex (gpt-5.x — effectively
   free on our plan) or Sonnet. After 8 Jul, cost pressure relaxes; judgment
   stays yours.
2. **Quality cannot suffer.** Cheap production is only acceptable because the
   watchdog protocol below catches what cheap models get wrong. If the
   protocol would be skipped, don't delegate — or don't do the work yet.

### Routing defaults during the window

- **Codex (gpt-5.x)** — first choice for everything with a writable spec:
  implementation, refactors, tests against a spec, data scripts, migrations,
  config, diagnosis with clear reproduction steps. If you can write the
  acceptance criteria, Codex can do the work.
- **Sonnet subagents** — Claude-native parallel work: research sweeps,
  DB/live-page investigation, multi-file searches, build tasks needing
  session-adjacent context that can't go to Codex, thin wrappers that drive
  `codex exec` inside workflows.
- **Fable/Opus** — reserve for: (a) specs and review of delegated output,
  (b) legal-judgment calls in the rubric/taxonomy/extraction prompts where a
  wrong call corrupts the product, (c) adversarial audits before anything
  reaches Ben, (d) rework after a cheaper model failed the bar twice. Keep
  these SHORT and focused — the token spend is in long producer runs, so
  never use Fable/Opus as a producer when a reviewed cheaper model would do.
- **Haiku** — trivial glue only.
- Borderline case? Try the cheaper model first with tight acceptance
  criteria. Escalation after a failed check costs less than defaulting
  everything to expensive models. But do not run legal-judgment work through
  a low-taste model even once: a plausible-but-wrong taxonomy or extraction
  rule is worse than no output, because it reads as correct.

### Watchdog protocol (what makes cheap production safe)

Every piece of delegated output passes these gates before it merges or
ships. No exceptions, including your own work:

1. **Spec first.** Delegations carry acceptance criteria written BEFORE the
   handoff: constraints, file paths, expected deliverable, what "done" looks
   like. A delegation you can't spec is work you shouldn't delegate.
2. **Diff review** against those criteria, read like a PR from a new
   contributor. Check what the diff does NOT do (dropped requirements,
   silent scope-narrowing) — that is where cheap models fail.
3. **Mechanical gates:** `npm test` + `npm run build`; scripts/ingest-qa.js
   gates for anything touching ingestion; the golden eval harness for
   extraction-prompt changes; quote verification stays at zero flags.
4. **Live verification** for anything user-facing — build ≠ runtime; check
   the deployed page, not just the code.
5. **Two-strike escalation:** if delegated output fails review twice, stop
   iterating cheap — redo on Fable/Opus. Log what failed so the routing
   improves. Standing permission: escalate without asking.
6. **Fable audits stay Fable.** Adversarial verification before Ben reviews
   is the quality backstop and is exempt from the conservation window — it's
   a small number of short, high-leverage runs. Never downgrade the auditor
   to save tokens; that is the one place cheap breaks the whole scheme.

### Mechanics

- **gpt-5.x is only reachable through the Codex CLI** (`codex exec` /
  `codex review`), local terminal sessions only. `/codex` for implementation
  handoffs, `/codex-review` for second-opinion reviews, `codex exec -s
  read-only` for investigation/data analysis. Codex gets NO conversation
  history — every prompt must be self-contained (task, file paths,
  constraints, deliverable) and must never include secrets.
- Claude models run via the Agent/Workflow `model` parameter. For gpt-5.x
  inside workflows/subagents, spawn a thin `model: 'sonnet', effort: 'low'`
  wrapper whose prompt composes a self-contained Codex prompt, runs
  `codex exec` via Bash, and returns the result verbatim.
- Extraction pipeline runs are subscription-CLI-powered (`--backend claude`,
  zero API tokens) — but they still consume Claude plan usage. During the
  window prefer `scripts/reprocess.js` per-type refreshes over full
  re-ingests, and consider `--backend codex` for extraction phases whose
  output is gated by QA + quote verification anyway.
- Never commit unreviewed delegate output.

### Repo-specific guide

- Good Codex candidates: component splits out of `pages/review/[id].js`,
  tests for `lib/` helpers against doc comments, one-off data-analysis
  scripts over Supabase exports, dependency/config chores, deterministic
  post-pass helpers with pinned fixtures.
- Spec-on-Fable, produce-on-cheap, review-on-Fable: UI changes, matcher/
  verification changes, classify rules (the safety check against all deals'
  section titles is the review).
- Fable/Opus end to end: `lib/rubric.js` / `lib/taxonomy.js` semantics,
  extraction-prompt engineering in `lib/parser-v2/extract.js`,
  canonical-provision design, final pre-Ben audits.
