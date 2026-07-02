---
name: codex-review
description: Get an independent second-opinion code review from the OpenAI Codex CLI on the current diff or a named change. Use when the user asks for a codex review or an extra review perspective.
disable-model-invocation: true
allowed-tools: Bash(codex *), Bash(git diff*), Bash(git log*), Bash(git show*), Read, Grep, Glob
---

# Independent review via Codex CLI

Run a second-provider review of `$ARGUMENTS` (default: the current working
diff against `main`). A different model family catches different failure
modes — treat this as an extra reviewer, not a replacement for your own review.
Terminal-only: requires the `codex` CLI installed and authenticated.

## Steps

1. **Determine the review target.** Default `git diff main...HEAD` (plus
   `git diff` for uncommitted work). If `$ARGUMENTS` names a commit, file, or
   PR, scope to that.

2. **Run the review, read-only:**

   ```bash
   codex exec -s read-only "Review the following change for correctness bugs,
   edge cases, and regressions. Be specific: file, line, failure scenario.
   Do NOT restyle or praise — findings only.

   <paste the diff, plus 10-20 lines of surrounding context for the key hunks>"
   ```

   If the CLI provides a native `codex review` command in this version, prefer
   it. For large diffs, review file-by-file rather than truncating.

3. **Triage the findings yourself.** For each finding: verify it against the
   actual code (Read the file — don't trust line numbers blindly), classify as
   real / stylistic / false positive, and note why.

4. **Report:** a short table of verified findings (severity, file:line, what
   breaks), which findings you rejected and why, and whether anything needs a
   fix before merge. Apply fixes only if the user asked for that.

## Notes

- Never include secrets or credentials in the prompt (check the diff for
  .env-ish content before sending).
- Codex sees only what you paste — include enough surrounding context that
  findings aren't artifacts of a truncated view.
