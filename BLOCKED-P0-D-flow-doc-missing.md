# BLOCKED: WP-PROCESSING-FLOW-MAP-01

`/admin/processing-flow` cannot be implemented from `origin/main` because both required source files are missing from the repository tree:

```text
docs/schema-shape/provision-processing-flow.md
docs/schema-shape/processing-flow-gaps.json
```

Verification:

```text
git ls-tree origin/main -- docs/schema-shape/provision-processing-flow.md docs/schema-shape/processing-flow-gaps.json
```

returns no entries.

Both files exist only as untracked local files in the original workspace. This WP is read-only against the Processing-Flow markdown file and data-driven from the committed gaps JSON, so Codex did not create or seed either file here.
