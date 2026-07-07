# Schema Shape Artifacts

This directory holds the Phase 0-B-tail canonical schema-shape export.

- `canonical-registry-v1.md` is the human-readable registry, one entry per current feature key.
- `normalized-v1.json` is the machine-readable registry consumed by Phase 0-C's `lib/schema-shape/` implementation.

The registry is generated from the deduped market registry plus the current schema, rubric, and category-summary feature declarations.

Aliases preserve historical and code-visible names so Phase 0-C can audit and reconcile old feature keys without hand-authoring missing dependencies.
