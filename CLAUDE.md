# Precedent Machine

Next.js M&A contract-review app: parses merger agreements (SEC filings),
classifies provisions, extracts structured features via Claude, renders a
review UI, and searches precedents across deals. Supabase Postgres backend;
deployed on Vercel (production tracks `main`). Run `npm test` (node:test) and
`npm run build` before pushing — CI enforces both.

## Standing directive: delegate by default

**Before starting ANY task, ask: can this go to Codex (gpt-5.x) or a cheaper
model?** Delegation is the default, not the exception. The main agent's time is
the scarce resource — spend it on legal judgment, product taste, orchestration,
and review, not on work a cheaper model does just as well.

- Reach for **Codex** (`/codex`, or `codex exec`) for anything mechanical or
  clear-spec: refactors, component splits, test-writing, data scripts,
  migrations, config chores, boilerplate. It's effectively free on our plan.
- Reach for a **subagent** (`general-purpose`, or `sonnet`/`haiku` via the
  Agent/Workflow `model` param) for self-contained research, search sweeps, or
  parallel build tasks.
- Keep on **opus/fable (the main agent)** only what genuinely needs high taste
  or legal judgment (see the rubric/taxonomy/extraction rule below), work that
  needs this session's decision history, or final review of delegated output.
- Fan out when tasks are independent: launch several delegates at once rather
  than doing them serially yourself.
- Always review delegated output like a PR from a new contributor: check the
  diff against constraints and run `npm test` + `npm run build` before merging.

When in doubt, delegate the doing and keep the deciding. The routing table
below is how you pick which model.

## Picking the right model for handoffs, workflows, and subagents

Rankings, higher = better. Cost reflects what we actually pay on current
plans, not list price. Intelligence is how hard a problem you can hand the
model unsupervised. Taste covers UI/UX, code quality, API design, copy — and
for this repo, legal-domain judgment. **These numbers are starting defaults —
edit them as experience accumulates.**

| model    | cost | intelligence | taste |
|----------|------|--------------|-------|
| gpt-5.x  | 9    | 8            | 5     |
| sonnet   | 5    | 5            | 7     |
| opus     | 3    | 8            | 9     |
| fable    | 2    | 9            | 9     |

How to apply:

- These are defaults, not limits. You have standing permission to override
  them: if a cheaper model's output doesn't meet the bar, rerun or redo the
  work with a smarter model without asking. Judge the output, not the price
  tag. Escalating costs less than shipping mediocre work.
- Cost is a tie-breaker only when the other axes conflict; otherwise
  intelligence > taste > cost.
- Bulk/mechanical work (clear-spec implementation, test-writing against a
  spec, data analysis, migrations, mechanical refactors): hand off to
  **gpt-5.x via Codex** — it's effectively free on our plan.
- Anything user-facing (UI, copy, API design) needs taste ≥ 7 — keep on
  **opus/fable**.
- Anything touching legal judgment — the rubric (`lib/rubric.js`), taxonomy
  (`lib/taxonomy.js`), extraction prompts (`lib/parser-v2/extract.js`),
  canonical-provision design — needs intelligence ≥ 8 AND taste ≥ 9. This is
  the product; do not delegate it to a low-taste model.
- Reviews of plans/implementations: fable or opus; optionally add gpt-5.x
  (`/codex-review`) as an extra independent perspective — a second provider
  catches different failure modes.
- Don't route real work to Haiku; trivial glue only.

Mechanics:

- **gpt-5.x is only reachable through the Codex CLI** (`codex exec` /
  `codex review`), which exists only in local terminal sessions. Use the
  `/codex` skill for implementation handoffs and `/codex-review` for
  second-opinion reviews. For work those don't cover (investigation, data
  analysis), run `codex exec -s read-only` directly with a self-contained
  prompt. Codex gets NO conversation history — every handoff prompt must be
  self-contained (task, file paths, constraints, expected deliverable), and
  must never include secrets.
- **Always review Codex output like a PR from a new contributor**: check the
  diff against the constraints, run `npm test` and `npm run build` before
  integrating. Never commit unreviewed delegate output.
- Claude models (sonnet, opus, fable) run via the Agent/Workflow `model`
  parameter.
- Using gpt-5.x inside workflows and subagents (the `model` parameter only
  takes Claude models, so use a wrapper): spawn a thin Claude wrapper agent
  with `model: 'sonnet', effort: 'low'` whose prompt instructs it to compose a
  self-contained Codex prompt, run `codex exec` via Bash, and return the
  result verbatim.

Repo-specific delegation guide:

- Good Codex candidates here: splitting components out of
  `pages/review/[id].js` (14k lines — mechanical, well-specified), writing
  tests for `lib/` helpers against their doc comments, one-off data-analysis
  scripts over the Supabase exports, dependency/config chores.
- Keep on Claude: anything in `lib/rubric.js` / `lib/taxonomy.js` /
  extraction-prompt engineering, canonical table design in the review UI,
  and anything requiring this session's product-decision history.
