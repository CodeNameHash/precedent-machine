---
name: codex
description: Hand a well-scoped subtask off to the OpenAI Codex CLI and integrate the result. Use when the user explicitly asks to delegate a task to Codex (e.g. "/codex refactor X", "hand this to codex").
disable-model-invocation: true
allowed-tools: Bash(codex *), Read, Grep, Glob
---

# Hand off a subtask to OpenAI Codex CLI

Delegate the task described in `$ARGUMENTS` to the Codex CLI, then review and
integrate its output. Codex runs LOCALLY — this skill only works in a terminal
session where the `codex` CLI is installed and authenticated
(`npm i -g @openai/codex`, then `codex login`; verify with `codex --version`).

## Steps

1. **Scope the handoff.** Restate the task in one paragraph. Identify the
   specific files/directories Codex needs (use Grep/Glob if unsure). A good
   handoff is self-contained: Codex gets no conversation history.

2. **Compose the prompt.** Include:
   - the task statement,
   - the relevant file paths (relative to repo root),
   - hard constraints (code style, files it must NOT touch, no new deps
     unless stated),
   - the expected deliverable (patch, new file, answer).

3. **Run it non-interactively from the repo root:**

   ```bash
   codex exec "<composed prompt>"
   ```

   Add `--full-auto` only if the user asked for autonomous edits; default to
   the sandboxed/suggest mode otherwise. If the task is long, write the prompt
   to a temp file and pass it with shell substitution: `codex exec "$(cat /tmp/handoff.md)"`.

4. **Review before trusting.** Read the diff/output Codex produced. Check it
   against the constraints, run `npm test` and `npm run build` if it touched
   code. Treat Codex output like a PR from a new contributor — verify, don't
   assume.

5. **Report back:** what was delegated, what came back, what you
   accepted/rejected and why, and current test/build status.

## Notes

- Never send secrets (keys, tokens, .env contents) in the handoff prompt.
- If `codex` is not installed or not authenticated, stop and tell the user the
  exact install/login commands instead of attempting workarounds.
- Good delegation candidates: mechanical refactors, isolated new modules,
  test-writing against a spec. Poor candidates: anything needing this
  session's conversation context or judgment about product intent.
