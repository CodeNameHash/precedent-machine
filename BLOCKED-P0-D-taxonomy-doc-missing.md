# BLOCKED: WP-TAXONOMY-MAP-01

`/admin/taxonomy` cannot be implemented from `origin/main` because the Taxonomy source file is missing from the repository tree:

```text
docs/schema-shape/provision-taxonomy-triple-model.md
```

Verification:

```text
git ls-tree origin/main -- docs/schema-shape/provision-taxonomy-triple-model.md
```

returns no entry.

The file exists only as an untracked local file in the original workspace. This WP is read-only against the Taxonomy file and must render the committed source of truth, so Codex did not create or seed it here.
