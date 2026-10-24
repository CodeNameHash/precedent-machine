# New-chat prompt, 2026-10-24

The paste-able copy of the prompt that starts the next manager session. This
is a dated note, not a plan authority: the authoritative prompt is section 12
of `docs/codex-program/notes/PRODUCT-LAUNCH-IMPLEMENTATION-PLAN-2026-09-04.md`,
and the state to start from is section 0 of
`docs/codex-program/notes/MANAGER-HANDOFF-2026-10-23.md`. If the two ever
disagree, section 12 wins.

Paste this as the first message of the new session. It needs a coding agent
with shell access (git, node, curl), not a session that can only read files.
Then send the Deployment Protection bypass secret and
`PRODUCT_INTERNAL_TOKEN` in a following message; they are the only things the
new session cannot get from the repository.

```text
/goal Own the Precedent Machine internal product launch through completion.

Repository: /Users/bengoodchild/Desktop/Corpus

Read, in this order: docs/core (PLAN, OPERATING-RULES, LEGAL-RULES,
CODEBASE-GUIDE); section 0 of
docs/codex-program/notes/MANAGER-HANDOFF-2026-10-23.md; then section 12 of
docs/codex-program/notes/PRODUCT-LAUNCH-IMPLEMENTATION-PLAN-2026-09-04.md and
findings (237) to (245) there. Section 12 is your own operating prompt — follow
it. It replaces the older Claude Code Remote loop: you have a shell, curl and
subagents, not Vercel or Supabase MCP tools.

Start with these two, in this order:
1. The silent-absence guard: a section that returns no facts must never read
   as "this agreement has no such provision". DeepSeek's run 34847358 did it
   on section 5.16; the hole is provider-independent and it is a false
   statement to a lawyer.
2. The Company's mirror breach termination right, lost on run 88d4032a to a
   cross-reference to a section limb ("Section 6.2(a)"), which discarded the
   whole fact.

Then the rest of the plan's next steps in the order section 0 gives them.

To reach the protected preview (https://deal-corpus-preview.vercel.app) I am
giving you, separately: the Deployment Protection bypass secret and
PRODUCT_INTERNAL_TOKEN. Ask me for a Vercel API token only when a worker
sandbox has to move to a new commit.

Work by push: every change verified before merge, both branches
(codex/product-implementation-plan-20260904 and
claude/festive-albattani-70cwn5), findings numbered in the plan in place, no
new status documents. Give every parallel agent its own git worktree with a
symlinked node_modules — two agents must never share a checkout.

Ask me only at the four points section 12 names: a genuine legal ambiguity, a
fact-shape decision, weakening a release bar, or production cutover. Come with
plain options and a recommendation.
```

## What the session will find, so you know it is oriented

- Deployed: `092a6239` carries the combined PW design work and the product
  line; the doc commits sit on top. The alias serves the codex and festive
  branches.
- Runs: Apogee on Claude `88d4032a` READY (858 valid facts, 11 held); Apogee
  on DeepSeek `34847358` READY (758 valid, 116 held, $18.02, and a verdict of
  "not the default" in finding (245)); Olaplex `ab1cf03b` paused at 27 of 87,
  resumable, and it still reports RUNNING with no worker.
- The preview read is 3.9 MB and about 16 s, with a minute of private cache
  for a finished run.
- Open, in the plan's order: the silent-absence guard; the cross-reference
  loss; 19 facts with no headline summary; Ben's caps rule (finding (239));
  the finalisation retry flakiness; the preview read model or a bigger
  database, a cost decision for Ben; DeepSeek only as a side branch.
