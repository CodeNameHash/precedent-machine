# BLOCKED-PREFLIGHT

Preflight cannot continue because a required master-brief companion file is missing from `origin/main`.

The kickoff instructions identify `precedent-machine-roadmap-v5.md` at the repo root as a companion brief. WP-INGEST-CATALOG also depends on that file directly: `pm-post-p0c-master.codex.md` Section 6 says its roadmap source is roadmap-v5 lines 122-200.

Checks performed:

- `git ls-tree -r --name-only origin/main | rg 'roadmap|precedent-machine-roadmap'` returned no files.
- Local search under `/Users/bengoodchild/Documents/Claude` and `/Users/bengoodchild/.codex/attachments` found no `precedent-machine-roadmap-v5.md` or roadmap-v5 replacement.
- Main CI for `545274b94d2aee00338f5f4f5da1fbfe14e1b1b9` is green.

I did not infer WP-INGEST-CATALOG from the short summary alone. Add the missing roadmap file to the repo root, or provide a replacement authoritative brief, then delete this blocker and resume preflight.
